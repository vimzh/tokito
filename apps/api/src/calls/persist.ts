import { asc, eq } from 'drizzle-orm'
import type { Db } from '../db'
import { answers, calls, callTurns, campaignEvents, questions, type Call, type CallStatus } from '../db/schema'
import { mapResult, statusFromOutcome, type MappedResult } from './result-mapper'
import { addOptOut } from '../services/opt-outs'
import { emitHook } from '../integrations/hooks'

const id = () => crypto.randomUUID()

export type TranscriptTurn = { speaker: 'assistant' | 'person' | 'unknown'; text: string; offsetSeconds: number | null }

export function callQuestions(db: Db, call: Pick<Call, 'campaignId' | 'questionMap'>) {
  const rows = db.select().from(questions).where(eq(questions.campaignId, call.campaignId)).orderBy(asc(questions.position)).all()
  const wanted = new Set(Object.values(call.questionMap))
  return rows.filter((question) => wanted.has(question.id))
}

// Writes a terminal result for a call: answers, summary, flags, timings, and an optional transcript.
export function persistCallResult(
  db: Db,
  call: Call,
  input: { structured: unknown; transcript?: TranscriptTurn[]; status?: CallStatus; failureCode?: string | null; failureMessage?: string | null; providerSummary?: string | null; eventType: string; now?: number },
): MappedResult {
  const known = callQuestions(db, call)
  const mapped = mapResult(input.structured, known, call.questionMap)
  const now = input.now ?? Date.now()
  const status = input.status ?? statusFromOutcome(mapped.outcome)
  db.transaction((tx) => {
    if (input.transcript) {
      tx.delete(callTurns).where(eq(callTurns.callId, call.id)).run()
      if (input.transcript.length)
        tx.insert(callTurns)
          .values(input.transcript.map((turn, position) => ({ id: id(), callId: call.id, position, speaker: turn.speaker, text: turn.text, offsetSeconds: turn.offsetSeconds })))
          .run()
    }
    tx.delete(answers).where(eq(answers.callId, call.id)).run()
    if (mapped.parsed && mapped.answers.length)
      tx.insert(answers)
        .values(mapped.answers.map((answer) => ({ id: id(), callId: call.id, campaignId: call.campaignId, contactId: call.contactId, ...answer, createdAt: now })))
        .run()
    tx.update(calls)
      .set({
        status,
        summary: mapped.summary ?? input.providerSummary ?? null,
        structuredResult: (input.structured ?? null) as Record<string, unknown> | null,
        requestsForOrganizer: mapped.requestsForOrganizer,
        callbackRequested: mapped.callbackRequested,
        callbackTime: mapped.callbackTime,
        optOut: mapped.optOut,
        failureCode: input.failureCode ?? null,
        failureMessage: input.failureMessage ?? null,
        endedAt: call.endedAt ?? now,
        durationSeconds: call.durationSeconds ?? (call.startedAt ? Math.round((now - call.startedAt) / 1000) : null),
        updatedAt: now,
      })
      .where(eq(calls.id, call.id))
      .run()
    tx.insert(campaignEvents).values({ id: id(), campaignId: call.campaignId, type: input.eventType, payload: { callId: call.id, outcome: mapped.outcome, status }, createdAt: now }).run()
  })
  void emitHook('call.terminal', { db, campaignId: call.campaignId, callId: call.id })
  return mapped
}

export function recordOptOutFromCall(db: Db, call: Pick<Call, 'contactId'>, phone: string | null) {
  if (!phone) return
  addOptOut(db, { phone, reason: 'Asked during a call not to be contacted again' })
}
