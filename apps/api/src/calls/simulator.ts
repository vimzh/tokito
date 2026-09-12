import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { MessageData } from '@strands-agents/sdk'
import type { Db } from '../db'
import { answers, calls, callTurns, campaigns, contacts, questions } from '../db/schema'
import type { StructuredRun } from '../ai/agent'
import { NotFoundError } from '../services/campaigns'
import { buildCallSpec } from './task-builder'
import type { MappedResult } from './result-mapper'
import { callQuestions, persistCallResult } from './persist'

const id = () => crypto.randomUUID()
const MAX_TURNS = 60

export class SimulationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SimulationError'
  }
}

const turnSchema = z.object({
  say: z.string().describe('Exactly what you say aloud next. One or two short sentences.'),
  end_call: z.boolean().describe('True only after you have said goodbye and the call is over.'),
})

const simulatorPreamble = `This is a text simulation of the phone call described below. A tester is typing what the person on the phone says. Reply with exactly what you would say aloud next, one turn at a time, in short spoken sentences. Never describe actions or add notes. Set end_call to true only after you have said goodbye.`

function loadCampaign(db: Db, campaignId: string) {
  const campaign = db.select().from(campaigns).where(eq(campaigns.id, campaignId)).get()
  if (!campaign) throw new NotFoundError('Campaign not found')
  const rows = db.select().from(questions).where(eq(questions.campaignId, campaignId)).orderBy(asc(questions.position)).all()
  return { campaign, questions: rows }
}

function loadCall(db: Db, campaignId: string, callId: string) {
  const call = db.select().from(calls).where(and(eq(calls.id, callId), eq(calls.campaignId, campaignId))).get()
  if (!call) throw new NotFoundError('Call not found')
  return call
}

function loadTurns(db: Db, callId: string) {
  return db.select().from(callTurns).where(eq(callTurns.callId, callId)).orderBy(asc(callTurns.position)).all()
}

function addTurn(db: Db, callId: string, position: number, speaker: 'assistant' | 'person', text: string) {
  const turn = { id: id(), callId, position, speaker, text, offsetSeconds: null }
  db.insert(callTurns).values(turn).run()
  return turn
}

const message = (role: 'user' | 'assistant', text: string): MessageData => ({ role, content: [{ text }] })

export function previewTask(db: Db, campaignId: string, contactId?: string) {
  const { campaign, questions: rows } = loadCampaign(db, campaignId)
  const contact = contactId ? db.select().from(contacts).where(and(eq(contacts.id, contactId), eq(contacts.campaignId, campaignId))).get() : undefined
  if (contactId && !contact) throw new NotFoundError('Contact not found')
  const spec = buildCallSpec(campaign, rows, contact ?? undefined)
  return { task: spec.task, resultSchema: spec.resultSchema, questionCount: rows.length }
}

export async function startSimulation(db: Db, campaignId: string, input: { contactId?: string; personName?: string }, run: StructuredRun) {
  const { campaign, questions: rows } = loadCampaign(db, campaignId)
  if (rows.length === 0) throw new SimulationError('Add at least one question before testing a call.')
  const contact = input.contactId ? db.select().from(contacts).where(and(eq(contacts.id, input.contactId), eq(contacts.campaignId, campaignId))).get() : undefined
  if (input.contactId && !contact) throw new NotFoundError('Contact not found')
  const person = contact ?? { name: input.personName?.trim() || null, context: {} }
  const spec = buildCallSpec(campaign, rows, person)
  const opening = await run({ system: `${simulatorPreamble}\n\n${spec.task}`, prompt: '[The call connects and the person answers the phone.]', schema: turnSchema })
  const now = Date.now()
  const call = {
    id: id(),
    campaignId,
    contactId: contact?.id ?? null,
    personName: person.name,
    provider: 'simulator' as const,
    providerCallId: null,
    attempt: 1,
    status: 'in_progress' as const,
    task: spec.task,
    resultSchema: spec.resultSchema,
    questionMap: spec.questionMap,
    summary: null,
    structuredResult: null,
    requestsForOrganizer: null,
    callbackRequested: false,
    callbackTime: null,
    optOut: false,
    failureCode: null,
    failureMessage: null,
    startedAt: now,
    endedAt: null,
    durationSeconds: null,
    createdAt: now,
    updatedAt: now,
  }
  db.insert(calls).values(call).run()
  const turn = addTurn(db, call.id, 0, 'assistant', opening.output.say)
  return { call, turn }
}

export async function simulationTurn(db: Db, campaignId: string, callId: string, text: string, run: StructuredRun) {
  const call = loadCall(db, campaignId, callId)
  if (call.provider !== 'simulator') throw new SimulationError('Only simulated calls accept typed turns.')
  if (call.status !== 'in_progress') throw new SimulationError('This simulated call has already ended.')
  const history = loadTurns(db, callId)
  const personTurn = addTurn(db, callId, history.length, 'person', text.trim())
  const messages = history.map((turn) => message(turn.speaker === 'assistant' ? 'assistant' : 'user', turn.text))
  const system = `${simulatorPreamble}\n\n${call.task}`
  const reply = await run({ system, prompt: text.trim(), schema: turnSchema, history: messages })
  const assistantTurn = addTurn(db, callId, history.length + 1, 'assistant', reply.output.say)
  const ended = reply.output.end_call || history.length + 2 >= MAX_TURNS
  if (!ended) return { personTurn, assistantTurn, ended: false as const, result: null }
  const result = await finalizeSimulation(db, campaignId, callId, run)
  return { personTurn, assistantTurn, ended: true as const, result }
}

async function finalizeSimulation(db: Db, campaignId: string, callId: string, run: StructuredRun): Promise<MappedResult> {
  const call = loadCall(db, campaignId, callId)
  const known = callQuestions(db, call)
  const { zodSchema } = buildCallSpec(loadCampaign(db, campaignId).campaign, known)
  const transcript = loadTurns(db, callId).map((turn) => `${turn.speaker === 'assistant' ? 'Assistant' : 'Person'}: ${turn.text}`).join('\n')
  const extraction = await run({
    system: `You read a transcript of a phone call and fill in the result record exactly as the person answered. Never invent an answer. Use skipped, declined, unknown, or not_asked for every gap. Copy the person's own words. For rating questions write only the digit. For choice questions write the option exactly as offered, or "other: " and their words.\n\nThe call's instructions were:\n${call.task}`,
    prompt: `Transcript:\n${transcript}`,
    schema: zodSchema,
  })
  return persistCallResult(db, call, { structured: extraction.output, eventType: 'call.simulated' })
}

export function listCalls(db: Db, campaignId: string) {
  loadCampaign(db, campaignId)
  const rows = db.select().from(calls).where(eq(calls.campaignId, campaignId)).orderBy(asc(calls.createdAt)).all()
  const answerRows = db.select().from(answers).where(eq(answers.campaignId, campaignId)).all()
  return rows.map((call) => ({ ...call, task: undefined, resultSchema: undefined, structuredResult: undefined, answers: answerRows.filter((answer) => answer.callId === call.id) }))
}

export function getCall(db: Db, campaignId: string, callId: string) {
  const call = loadCall(db, campaignId, callId)
  return { ...call, turns: loadTurns(db, callId), answers: db.select().from(answers).where(eq(answers.callId, callId)).all() }
}
