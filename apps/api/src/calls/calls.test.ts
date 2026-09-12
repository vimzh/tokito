import { beforeEach, describe, expect, test } from 'bun:test'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { createDb, type Db } from '../db'
import type { StructuredRun } from '../ai/agent'
import { createCampaign, replaceQuestions } from '../services/campaigns'
import { buildCallSpec, buildResultSchema, findUnsupportedSchemaKeys, type CallQuestion } from './task-builder'
import { mapResult, statusFromProvider } from './result-mapper'
import { getCall, listCalls, simulationTurn, startSimulation } from './simulator'

const questions: CallQuestion[] = [
  { id: 'a', text: 'Have you tried the new menu?', type: 'choice', options: ['Yes', 'No'], required: true },
  { id: 'b', text: 'What did you think of the prices?', type: 'open', options: null, required: true },
  { id: 'c', text: 'How would you rate the portions from 1 to 5?', type: 'rating', options: null, required: false },
]
const campaign = { name: 'Menu feedback', goal: 'Learn what customers think of the new menu.', context: 'Family restaurant in Pune.', language: 'en' as const, conversationMode: 'dynamic' as const, clarificationsAllowed: true, maxCallMinutes: 5 }

describe('task builder', () => {
  test('writes the task with identity, questions, rules, and context', () => {
    const spec = buildCallSpec(campaign, questions, { name: 'Asha', context: { Visit: 'Tuesday' } })
    expect(spec.task).toContain('AI assistant')
    expect(spec.task).toContain('Greet Asha')
    expect(spec.task).toContain('Family restaurant in Pune')
    expect(spec.task).toContain('Visit: Tuesday')
    expect(spec.task).toContain('q1. Have you tried the new menu? (Offer these options: Yes, No.)')
    expect(spec.task).toContain('q3. How would you rate the portions from 1 to 5? (Ask for a number from 1 to 5.) (Optional')
    expect(spec.task).toContain('one short follow-up')
    expect(spec.task).toContain('under 5 minutes')
    expect(spec.questionMap).toEqual({ q1: 'a', q2: 'b', q3: 'c' })
  })

  test('fixed mode and no clarifications change the rules', () => {
    const task = buildCallSpec({ ...campaign, conversationMode: 'fixed', clarificationsAllowed: false }, questions).task
    expect(task).toContain('Do not add follow-up questions')
    expect(task).toContain('Do not add information')
  })

  test('result schema exports JSON Schema with one entry per question', () => {
    const { jsonSchema } = buildResultSchema(questions)
    const properties = (jsonSchema as { properties: { answers: { properties: Record<string, unknown> } } }).properties
    expect(Object.keys(properties.answers.properties)).toEqual(['q1', 'q2', 'q3'])
    expect(Object.keys(properties)).toEqual(expect.arrayContaining(['outcome', 'callback', 'opt_out', 'person_summary']))
    expect(findUnsupportedSchemaKeys(jsonSchema)).toEqual([])
    expect(Object.keys(jsonSchema)).not.toContain('$schema')
  })
})

describe('result mapper', () => {
  const map = { q1: 'a', q2: 'b', q3: 'c' }
  test('maps answers, parses ratings and choices, keeps gaps', () => {
    const result = mapResult(
      {
        outcome: 'partial',
        answers: { q1: { answer_status: 'answered', value: 'yes', notes: '' }, q2: { answer_status: 'declined', value: '', notes: '' }, q3: { answer_status: 'answered', value: 'about a 4', notes: 'pasta was small' } },
        callback: { requested: 'no', preferred_time: '' },
        opt_out: 'no',
        person_summary: 'Tried it, would not discuss prices.',
        requests_for_organizer: '',
      },
      questions,
      map,
    )
    expect(result.parsed).toBe(true)
    expect(result.answers[0]).toMatchObject({ questionId: 'a', status: 'answered', value: 'Yes' })
    expect(result.answers[1]).toMatchObject({ questionId: 'b', status: 'declined', value: null })
    expect(result.answers[2]).toMatchObject({ questionId: 'c', status: 'answered', value: '4', valueNumber: 4, notes: 'pasta was small' })
    expect(result.summary).toBe('Tried it, would not discuss prices.')
  })

  test('callback and opt-out are surfaced; unparseable results become unknown', () => {
    const cb = mapResult({ outcome: 'callback_requested', answers: { q1: { answer_status: 'not_asked', value: '', notes: '' }, q2: { answer_status: 'not_asked', value: '', notes: '' }, q3: { answer_status: 'not_asked', value: '', notes: '' } }, callback: { requested: 'yes', preferred_time: 'tomorrow after 6' }, opt_out: 'no', person_summary: '', requests_for_organizer: '' }, questions, map)
    expect(cb).toMatchObject({ callbackRequested: true, callbackTime: 'tomorrow after 6' })
    const bad = mapResult({ nonsense: true }, questions, map)
    expect(bad.parsed).toBe(false)
    expect(bad.answers.map((a) => a.status)).toEqual(['unknown', 'unknown', 'unknown'])
  })

  test('provider statuses map to call statuses', () => {
    expect(statusFromProvider({ taskStatus: 'failed', failureCode: 'no_answer' })).toBe('no_answer')
    expect(statusFromProvider({ taskStatus: 'failed', failureCode: 'busy' })).toBe('busy')
    expect(statusFromProvider({ taskStatus: 'completed', outcome: 'opted_out' })).toBe('opted_out')
    expect(statusFromProvider({ taskStatus: 'in_progress', attemptStatus: 'dialing' })).toBe('dialing')
    expect(statusFromProvider({ taskStatus: 'canceled' })).toBe('canceled')
  })
})

describe('simulator', () => {
  let db: Db
  let campaignId: string
  beforeEach(() => {
    db = createDb(':memory:')
    migrate(db, { migrationsFolder: './drizzle' })
    campaignId = createCampaign(db, { name: 'Menu', goal: 'Menu feedback', questionSource: 'manual', conversationMode: 'dynamic', questions: ['Have you tried the new menu?'] }).id
    replaceQuestions(db, campaignId, { questions: [{ text: 'Have you tried the new menu?', type: 'choice', options: ['Yes', 'No'], required: true, source: 'manual' }, { text: 'What did you think of the prices?', type: 'open', options: [], required: true, source: 'manual' }] })
  })

  test('runs a call to completion and stores turns and answers', async () => {
    const calls: string[] = []
    const run: StructuredRun = async ({ prompt, schema, history }) => {
      calls.push(prompt)
      if ('shape' in schema && 'say' in (schema as { shape: Record<string, unknown> }).shape) {
        const turns = (history?.length ?? 0) + 1
        return { output: schema.parse({ say: turns >= 3 ? 'Thank you, goodbye.' : 'Have you tried the new menu?', end_call: turns >= 3 }), model: 'fake' }
      }
      return { output: schema.parse({ outcome: 'completed', answers: { q1: { answer_status: 'answered', value: 'Yes', notes: '' }, q2: { answer_status: 'answered', value: 'Too expensive', notes: 'pasta' } }, callback: { requested: 'no', preferred_time: '' }, opt_out: 'no', person_summary: 'Tried it; found it expensive.', requests_for_organizer: '' }), model: 'fake' }
    }
    const { call, turn } = await startSimulation(db, campaignId, { personName: 'Tester' }, run)
    expect(call.status).toBe('in_progress')
    expect(turn).toMatchObject({ position: 0, speaker: 'assistant' })
    const first = await simulationTurn(db, campaignId, call.id, 'Yes I did', run)
    expect(first.ended).toBe(false)
    const second = await simulationTurn(db, campaignId, call.id, 'Too expensive', run)
    expect(second.ended).toBe(true)
    expect(second.result?.summary).toBe('Tried it; found it expensive.')
    const stored = getCall(db, campaignId, call.id)
    expect(stored.status).toBe('completed')
    expect(stored.turns.map((t) => t.speaker)).toEqual(['assistant', 'person', 'assistant', 'person', 'assistant'])
    expect(stored.answers.map((a) => a.value)).toEqual(['Yes', 'Too expensive'])
    expect(listCalls(db, campaignId)[0]?.answers).toHaveLength(2)
    await expect(simulationTurn(db, campaignId, call.id, 'more', run)).rejects.toThrow('already ended')
    expect(calls.at(-1)).toContain('Transcript:')
  })
})
