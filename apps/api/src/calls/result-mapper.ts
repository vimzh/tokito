import { type AnswerStatus, type CallStatus } from '../db/schema'
import { buildResultSchema, type CallOutcome, type CallQuestion } from './task-builder'

export type MappedAnswer = {
  questionId: string
  questionText: string
  status: AnswerStatus
  value: string | null
  valueNumber: number | null
  notes: string | null
}

export type MappedResult = {
  parsed: boolean
  outcome: CallOutcome
  answers: MappedAnswer[]
  callbackRequested: boolean
  callbackTime: string | null
  optOut: boolean
  summary: string | null
  requestsForOrganizer: string | null
}

const empty = (value: string | undefined) => (value && value.trim() ? value.trim() : null)

// Turns a structured result (from CALL-E or the simulator) into answer rows, never inventing values.
export function mapResult(structured: unknown, questions: CallQuestion[], questionMap: Record<string, string>): MappedResult {
  const { zodSchema } = buildResultSchema(questions)
  const parsed = zodSchema.safeParse(structured)
  const byId = new Map(questions.map((question) => [question.id, question]))
  if (!parsed.success) {
    return {
      parsed: false,
      outcome: 'no_conversation',
      answers: Object.values(questionMap).map((questionId) => ({ questionId, questionText: byId.get(questionId)?.text ?? '', status: 'unknown', value: null, valueNumber: null, notes: null })),
      callbackRequested: false,
      callbackTime: null,
      optOut: false,
      summary: null,
      requestsForOrganizer: null,
    }
  }
  const data = parsed.data
  const answers: MappedAnswer[] = Object.entries(questionMap).map(([key, questionId]) => {
    const question = byId.get(questionId)
    const raw = data.answers[key]
    const status: AnswerStatus = raw?.answer_status ?? 'unknown'
    const value = status === 'answered' ? empty(raw?.value) : null
    let valueNumber: number | null = null
    let finalValue = value
    if (question?.type === 'rating' && value) {
      const match = value.match(/[1-5]/)
      valueNumber = match ? Number(match[0]) : null
      finalValue = valueNumber === null ? value : String(valueNumber)
    }
    if (question?.type === 'choice' && value) {
      const option = (question.options ?? []).find((candidate) => candidate.toLowerCase() === value.toLowerCase())
      finalValue = option ?? value
    }
    return { questionId, questionText: question?.text ?? '', status: value === null && status === 'answered' ? 'unknown' : status, value: finalValue, valueNumber, notes: empty(raw?.notes) }
  })
  return {
    parsed: true,
    outcome: data.outcome,
    answers,
    callbackRequested: data.callback.requested === 'yes' || data.outcome === 'callback_requested',
    callbackTime: empty(data.callback.preferred_time),
    optOut: data.opt_out === 'yes' || data.outcome === 'opted_out',
    summary: empty(data.person_summary),
    requestsForOrganizer: empty(data.requests_for_organizer),
  }
}

export function statusFromOutcome(outcome: CallOutcome): CallStatus {
  if (outcome === 'no_conversation') return 'no_answer'
  if (outcome === 'declined' || outcome === 'wrong_person') return 'declined'
  if (outcome === 'callback_requested') return 'callback_requested'
  if (outcome === 'opted_out') return 'opted_out'
  return 'completed'
}

// CALL-E lifecycle values (task, recipient, attempt) → Tokito call status. Used by Phase 5's webhook handler.
export function statusFromProvider(input: { taskStatus: string; recipientStatus?: string | null; attemptStatus?: string | null; failureCode?: string | null; outcome?: CallOutcome | null }): CallStatus {
  const failure = (input.failureCode ?? '').toLowerCase()
  if (input.taskStatus === 'canceled') return 'canceled'
  if (input.taskStatus === 'queued') return 'queued'
  if (input.taskStatus === 'in_progress') return input.attemptStatus === 'dialing' ? 'dialing' : 'in_progress'
  if (input.taskStatus === 'failed' || input.recipientStatus === 'failed' || input.attemptStatus === 'failed') {
    if (failure.includes('no_answer') || failure.includes('no-answer') || failure.includes('unanswered')) return 'no_answer'
    if (failure.includes('busy')) return 'busy'
    return 'failed'
  }
  return input.outcome ? statusFromOutcome(input.outcome) : 'completed'
}
