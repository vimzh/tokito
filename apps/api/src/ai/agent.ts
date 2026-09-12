// Thin wrapper over a Strands agent so services depend on one small function that tests can fake.
import { Agent, ModelError, ModelThrottledError, StructuredOutputError } from '@strands-agents/sdk'
import { OpenAIModel } from '@strands-agents/sdk/models/openai'
import type { MessageData } from '@strands-agents/sdk'
import type { z } from 'zod'
import { aiConfig, AiNotConfiguredError, AiRequestError } from './config'

export type StructuredRun = <T extends z.ZodType>(args: { system: string; prompt: string; schema: T; history?: MessageData[] }) => Promise<{ output: z.output<T>; model: string }>

export function createOpenAiModel() {
  if (!aiConfig.apiKey) throw new AiNotConfiguredError()
  return new OpenAIModel({
    modelId: aiConfig.model,
    apiKey: aiConfig.apiKey,
    params: { reasoning: { effort: aiConfig.reasoningEffort } },
  })
}

// A fresh Agent per run keeps every request stateless; the agent would otherwise accumulate history.
export function createStructuredRun(model = createOpenAiModel()): StructuredRun {
  return async ({ system, prompt, schema, history }) => {
    const agent = new Agent({ model, systemPrompt: system, structuredOutputSchema: schema, printer: false, messages: history ?? [] })
    let result
    try {
      result = await agent.invoke(prompt)
    } catch (error) {
      if (error instanceof ModelThrottledError) throw new AiRequestError('OpenAI rate limit reached. Try again shortly.')
      if (error instanceof StructuredOutputError) throw new AiRequestError('The model did not return a usable structured result.')
      if (error instanceof ModelError) throw new AiRequestError(`OpenAI request failed: ${error.message}`)
      throw error
    }
    if (result.structuredOutput === undefined) throw new AiRequestError('The model did not return a usable structured result.')
    return { output: result.structuredOutput as z.output<typeof schema>, model: aiConfig.model }
  }
}
