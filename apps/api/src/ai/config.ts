// Single place for model choice so later phases (conversation engine, reports) share it.
// The agent framework is Strands Agents; the model provider is OpenAI through its API.
export const aiConfig = {
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL ?? 'gpt-5.5',
  reasoningEffort: 'medium' as const,
}

export type ReasoningEffort = 'low' | 'medium' | 'high'

export class AiNotConfiguredError extends Error {
  constructor() {
    super('AI drafting is not configured. Set OPENAI_API_KEY for the API and restart it.')
    this.name = 'AiNotConfiguredError'
  }
}

export class AiRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiRequestError'
  }
}
