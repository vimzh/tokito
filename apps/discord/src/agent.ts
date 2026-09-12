import { Agent, type MessageData } from '@strands-agents/sdk'
import { OpenAIModel } from '@strands-agents/sdk/models/openai'
import { config } from './config'
import { buildTools, type ToolContext } from './tools'

export const systemPrompt = `You are Tokito's assistant in Discord. Tokito runs phone campaigns: an organizer describes what they want to learn, Tokito drafts questions, calls a contact list, and reports what people said.

You act only through your tools, which talk to the same system as the dashboard. Rules:
- Be brief and concrete; Discord messages are short. Use plain text with light Markdown.
- Never claim something happened unless a tool confirmed it. Starting, pausing, or stopping calls and replacing questions always need the user's confirmation button; say so and stop.
- When the user attaches a spreadsheet and names a campaign, import it. When they describe a goal, create the campaign and offer to draft questions.
- Quote people's answers only as returned by tools; never invent answers, counts, or names.
- If a campaign name is ambiguous or missing, ask which one.`

const histories = new Map<string, MessageData[]>()
const HISTORY_LIMIT = 20

export function rememberTurn(channelId: string, user: string, assistant: string) {
  const history = histories.get(channelId) ?? []
  history.push({ role: 'user', content: [{ text: user }] }, { role: 'assistant', content: [{ text: assistant }] })
  histories.set(channelId, history.slice(-HISTORY_LIMIT))
}

export async function runAgent(text: string, ctx: ToolContext) {
  if (!config.openaiKey) throw new Error('OPENAI_API_KEY is not set for the Discord bot.')
  const model = new OpenAIModel({ modelId: config.model, apiKey: config.openaiKey, params: { reasoning: { effort: 'low' } } })
  const agent = new Agent({ model, systemPrompt, tools: buildTools(ctx), messages: histories.get(ctx.channelId) ?? [], printer: false })
  const result = await agent.invoke(text)
  const reply = String(result).trim() || 'Done.'
  rememberTurn(ctx.channelId, text, reply)
  return reply
}
