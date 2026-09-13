// Thin wrapper over a Strands agent so services depend on one small function that tests can fake.
import { Agent, ModelError, ModelThrottledError, StructuredOutputError } from '@strands-agents/sdk'
import { OpenAIModel } from '@strands-agents/sdk/models/openai'
import type { MessageData } from '@strands-agents/sdk'
import type { z } from 'zod'
import { aiConfig, AiNotConfiguredError, AiRequestError, type ReasoningEffort } from './config'

export type Usage = { inputTokens: number; outputTokens: number; totalTokens: number }
export type StructuredRun = <T extends z.ZodType>(args: { system: string; prompt: string; schema: T; history?: MessageData[]; effort?: ReasoningEffort }) => Promise<{ output: z.output<T>; model: string; usage?: Usage }>

// Running totals per model id, for cost reporting in evaluations.
export const usageTotals = new Map<string, Usage & { calls: number }>()
function addUsage(model: string, usage: Usage | undefined) {
  const current = usageTotals.get(model) ?? { inputTokens: 0, outputTokens: 0, totalTokens: 0, calls: 0 }
  usageTotals.set(model, { inputTokens: current.inputTokens + (usage?.inputTokens ?? 0), outputTokens: current.outputTokens + (usage?.outputTokens ?? 0), totalTokens: current.totalTokens + (usage?.totalTokens ?? 0), calls: current.calls + 1 })
}

export function createOpenAiModel(effort: ReasoningEffort = aiConfig.reasoningEffort, modelId = aiConfig.model) {
  if (!aiConfig.apiKey) throw new AiNotConfiguredError()
  return new OpenAIModel({
    modelId,
    apiKey: aiConfig.apiKey,
    params: { reasoning: { effort } },
  })
}

// A fresh Agent per run keeps every request stateless; the agent would otherwise accumulate history.
export function createStructuredRun(model = createOpenAiModel(), options: { modelId?: string; fixedEffort?: ReasoningEffort } = {}): StructuredRun {
  const modelId = options.modelId ?? aiConfig.model
  const byEffort = new Map<ReasoningEffort, OpenAIModel>()
  const modelFor = (effort?: ReasoningEffort) => {
    const wanted = options.fixedEffort ?? effort
    if (!wanted || wanted === aiConfig.reasoningEffort) return model
    if (!byEffort.has(wanted)) byEffort.set(wanted, createOpenAiModel(wanted, modelId))
    return byEffort.get(wanted)!
  }
  return async ({ system, prompt, schema, history, effort }) => {
    const agent = new Agent({ model: modelFor(effort), systemPrompt: system, structuredOutputSchema: schema, printer: false, messages: history ?? [] })
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
    const metrics = (result as unknown as { metrics?: { latestAgentInvocation?: { usage?: Partial<Usage> }; accumulatedUsage?: Partial<Usage> } }).metrics
    const raw = metrics?.latestAgentInvocation?.usage ?? metrics?.accumulatedUsage
    const usage = raw ? { inputTokens: raw.inputTokens ?? 0, outputTokens: raw.outputTokens ?? 0, totalTokens: raw.totalTokens ?? (raw.inputTokens ?? 0) + (raw.outputTokens ?? 0) } : undefined
    addUsage(modelId, usage)
    return { output: result.structuredOutput as z.output<typeof schema>, model: modelId, usage }
  }
}
