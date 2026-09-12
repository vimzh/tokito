import { z } from 'zod'
import { answerStatuses, languages, type Campaign, type Contact, type Question } from '../db/schema'

export type CallQuestion = Pick<Question, 'id' | 'text' | 'type' | 'options' | 'required'>
export type CallContact = Pick<Contact, 'name' | 'context'> | { name: string | null; context: Record<string, string> }

export const callOutcomes = ['completed', 'partial', 'declined', 'wrong_person', 'callback_requested', 'opted_out', 'no_conversation'] as const
export type CallOutcome = (typeof callOutcomes)[number]

const languageNames: Record<(typeof languages)[number], string> = { en: 'English', hi: 'Hindi' }
export const questionKey = (index: number) => `q${index + 1}`

// Builds the zod result schema CALL-E fills per recipient, plus its JSON Schema form and the key → question id map.
export function buildResultSchema(questions: CallQuestion[]) {
  const answerShape = Object.fromEntries(
    questions.map((question, index) => [
      questionKey(index),
      z.object({
        answer_status: z.enum(answerStatuses).describe('answered when the person gave an answer; skipped when they moved on; declined when they refused; unknown when they did not know; not_asked when the call ended before it.'),
        value: z.string().describe(valueDescription(question)),
        notes: z.string().describe('Reasons, examples, or follow-up details the person gave, in their words. Empty if none.'),
      }),
    ]),
  )
  const zodSchema = z.object({
    outcome: z.enum(callOutcomes).describe('completed: all questions handled. partial: some answered before the call ended. declined: did not want to take part. wrong_person: the number did not reach the intended person. callback_requested: asked to be called at another time. opted_out: asked never to be called again. no_conversation: nothing meaningful was said.'),
    answers: z.object(answerShape),
    callback: z.object({
      requested: z.enum(['yes', 'no']).describe('yes only if the person asked to be called at another time.'),
      preferred_time: z.string().describe('The time or day the person asked for, in their words. Empty if none.'),
    }),
    opt_out: z.enum(['yes', 'no']).describe('yes only if the person asked not to be contacted again.'),
    person_summary: z.string().describe('Two or three sentences on what the person said, without adding opinions.'),
    requests_for_organizer: z.string().describe('Anything the person asked the organizer to do or send. Empty if none.'),
  })
  const questionMap = Object.fromEntries(questions.map((question, index) => [questionKey(index), question.id]))
  return { zodSchema, jsonSchema: sanitizeJsonSchema(z.toJSONSchema(zodSchema) as Record<string, unknown>), questionMap }
}

// CALL-E accepts only type, properties, required, enum, description, items, and additionalProperties: false.
export const unsupportedSchemaKeys = ['$ref', '$schema', '$defs', 'oneOf', 'anyOf', 'allOf', 'not', 'format', 'pattern'] as const

export function sanitizeJsonSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const { $schema: _dropped, ...rest } = schema as Record<string, unknown> & { $schema?: string }
  return rest
}

export function findUnsupportedSchemaKeys(schema: unknown, path = '$'): string[] {
  if (Array.isArray(schema)) return schema.flatMap((item, index) => findUnsupportedSchemaKeys(item, `${path}[${index}]`))
  if (!schema || typeof schema !== 'object') return []
  return Object.entries(schema).flatMap(([key, value]) => [
    ...((unsupportedSchemaKeys as readonly string[]).includes(key) ? [`${path}.${key}`] : []),
    ...(key === 'additionalProperties' && value === true ? [`${path}.additionalProperties=true`] : []),
    ...findUnsupportedSchemaKeys(value, `${path}.${key}`),
  ])
}

function valueDescription(question: CallQuestion) {
  if (question.type === 'rating') return 'The number from 1 to 5 the person chose, as digits. Empty if not answered.'
  if (question.type === 'choice') return `One of: ${(question.options ?? []).join(' | ')}. If none fit, write "other: " followed by their words. Empty if not answered.`
  return "The person's answer in their own words. Empty if not answered."
}

export type TaskCampaign = Pick<Campaign, 'name' | 'goal' | 'context' | 'language' | 'conversationMode' | 'clarificationsAllowed' | 'maxCallMinutes'>

// Writes the natural-language task CALL-E's voice agent follows for one person.
export function buildTask(campaign: TaskCampaign, questions: CallQuestion[], contact?: CallContact) {
  const personName = contact?.name?.trim() || 'the person who answers'
  const context = contact?.context ? Object.entries(contact.context).filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`) : []
  const lines: string[] = []
  lines.push(`You are Tokito, an AI assistant calling on behalf of the organizer of "${campaign.name}". Speak ${languageNames[campaign.language]}. Keep the call under ${campaign.maxCallMinutes} minutes.`)
  lines.push('')
  lines.push('OPENING')
  lines.push(`Greet ${personName}. Say clearly that you are an AI assistant calling for the organizer, that the purpose is to hear their views, that the call takes a few minutes, and that notes are taken so the organizer can read what was said. Ask whether now is a good time. If they say no, ask when would suit them, record it as a callback request, thank them, and end the call.`)
  lines.push('')
  lines.push('PURPOSE')
  lines.push(`The organizer wants to learn: ${campaign.goal}`)
  if (campaign.context) {
    lines.push('')
    lines.push('BACKGROUND FROM THE ORGANIZER')
    lines.push(campaign.context)
  }
  if (context.length) {
    lines.push('')
    lines.push('WHAT THE ORGANIZER KNOWS ABOUT THIS PERSON')
    lines.push(context.join('\n'))
  }
  lines.push('')
  lines.push('QUESTIONS, IN THIS ORDER')
  questions.forEach((question, index) => {
    const parts = [`${questionKey(index)}. ${question.text}`]
    if (question.type === 'rating') parts.push('(Ask for a number from 1 to 5.)')
    if (question.type === 'choice') parts.push(`(Offer these options: ${(question.options ?? []).join(', ')}.)`)
    if (!question.required) parts.push('(Optional; skip if time is short.)')
    lines.push(parts.join(' '))
  })
  lines.push('')
  lines.push('HOW TO RUN THE CONVERSATION')
  lines.push('- Ask one question at a time in natural spoken language. Do not read labels like q1 aloud.')
  lines.push('- If an early question shows the person has not had the experience later questions assume (for example, they have not tried the menu or did not attend), do not ask those questions as if they had; mark them not_asked and move to what still applies.')
  lines.push(
    campaign.conversationMode === 'dynamic'
      ? '- When an answer is vague or matters to the purpose, ask one short follow-up for the reason, an example, or a detail. Never lead toward an answer, never suggest a verdict, and never ask again something the person already explained.'
      : '- Ask only the prepared questions, in order. Do not add follow-up questions.',
  )
  lines.push(
    campaign.clarificationsAllowed
      ? '- If asked to repeat or explain a question, repeat it or explain it using only the background above. Do not invent facts.'
      : '- If asked to explain a question, repeat it in simpler words. Do not add information.',
  )
  lines.push('- If the person skips a question, record it as skipped. If they refuse, record it as declined. If they do not know, record it as unknown. Never fill in an answer they did not give.')
  lines.push('- If they ask to stop, thank them and end the call at once. If they say they never want to be called again, confirm you have noted that, record opt-out, and end the call.')
  lines.push('- If they ask to be called at another time, record the time in their words as a callback request and end the call politely.')
  lines.push('- Never pressure anyone, never pretend to be human, and never promise anything on behalf of the organizer. If they ask for something, note it for the organizer.')
  lines.push('')
  lines.push('CLOSING')
  lines.push('Thank them for their time, say the organizer will read their answers, and say goodbye.')
  lines.push('')
  lines.push('RECORDING THE RESULT')
  lines.push("Fill the result exactly as the person answered, in their words. Use the answer_status values for gaps. Set outcome, callback, and opt_out truthfully. Write a two or three sentence person_summary of what they said without adding opinions.")
  return lines.join('\n')
}

export function buildCallSpec(campaign: TaskCampaign, questions: CallQuestion[], contact?: CallContact) {
  const { zodSchema, jsonSchema, questionMap } = buildResultSchema(questions)
  return { task: buildTask(campaign, questions, contact), zodSchema, resultSchema: jsonSchema, questionMap }
}
