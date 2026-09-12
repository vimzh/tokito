import { beforeEach, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { createDb, type Db } from '../db'
import { calls, campaigns, optOuts } from '../db/schema'
import { createCampaign, replaceQuestions, updateCampaign } from '../services/campaigns'
import { commitImport, createImport, listContacts } from '../services/contacts'
import { getCall } from './simulator'
import { handleWebhookEvent, outreachStatus, pauseOutreach, scheduleCallback, startOutreach, stopOutreach, tick, withinCallingHours } from './scheduler'
import { ProviderError, type CallProvider, type CreateCallInput, type ProviderTask } from './provider'

class FakeProvider implements CallProvider {
  created: CreateCallInput[] = []
  tasks = new Map<string, ProviderTask>()
  failWith: ProviderError | null = null
  async createCall(input: CreateCallInput): Promise<ProviderTask> {
    if (this.failWith) throw this.failWith
    this.created.push(input)
    const task: ProviderTask = { id: `calle_${this.created.length}`, status: 'in_progress', summary: null, recipients: [{ id: 'rcp_1', phones: [input.phone], status: 'in_progress', structured_result: null, summary: null, attempts: [] }] }
    this.tasks.set(task.id, task)
    return task
  }
  async getCall(id: string) {
    return this.tasks.get(id)!
  }
}

const completedTask = (id: string, phone: string, overrides: Partial<ProviderTask> = {}): ProviderTask => ({
  id,
  status: 'completed',
  summary: 'Done',
  recipients: [
    {
      id: 'rcp_1',
      phones: [phone],
      status: 'completed',
      structured_result: {
        outcome: 'completed',
        answers: { q1: { answer_status: 'answered', value: 'Yes', notes: '' }, q2: { answer_status: 'answered', value: 'Bit pricey', notes: 'pasta' } },
        callback: { requested: 'no', preferred_time: '' },
        opt_out: 'no',
        person_summary: 'Tried it and found it pricey.',
        requests_for_organizer: '',
      },
      summary: 'Tried it and found it pricey.',
      attempts: [
        {
          id: 'att_1', phone, status: 'completed', started_at: '2026-09-14T06:00:00Z', completed_at: '2026-09-14T06:03:00Z', summary: null,
          transcript_turns: [{ offset_seconds: 0, speaker: 'bot', text: 'Hello, this is Tokito.' }, { offset_seconds: 4, speaker: 'user', text: 'Hi.' }],
          provider_call_id: 'prov_1', failure_code: null, failure_message: null,
        },
      ],
    },
  ],
  ...overrides,
})

// 2026-09-14 06:30 UTC = 12:00 in Asia/Kolkata, inside the default 10:00–18:00 window.
const NOON_IST = Date.UTC(2026, 8, 14, 6, 30)
const MIDNIGHT_IST = Date.UTC(2026, 8, 14, 18, 30)

let db: Db
let campaignId: string
let provider: FakeProvider

beforeEach(() => {
  db = createDb(':memory:')
  migrate(db, { migrationsFolder: './drizzle' })
  provider = new FakeProvider()
  campaignId = createCampaign(db, { name: 'Menu', goal: 'Menu feedback', questionSource: 'manual', conversationMode: 'dynamic', questions: ['Have you tried the new menu?', 'What did you think of the prices?'] }).id
  replaceQuestions(db, campaignId, { questions: [{ text: 'Have you tried the new menu?', type: 'choice', options: ['Yes', 'No'], required: true, source: 'manual' }, { text: 'What did you think of the prices?', type: 'open', options: [], required: true, source: 'manual' }] })
  const preview = createImport(db, campaignId, 'c.csv', new TextEncoder().encode('Name,Phone\nAsha,9876543210\nRavi,9876543211\n'))
  commitImport(db, campaignId, preview.id, { nameColumn: 0, phoneColumn: 1, contextColumns: [] })
})

describe('calling hours', () => {
  test('uses the campaign time zone', () => {
    const campaign = { callingHoursStart: '10:00', callingHoursEnd: '18:00', timezone: 'Asia/Kolkata' }
    expect(withinCallingHours(campaign, NOON_IST)).toBe(true)
    expect(withinCallingHours(campaign, MIDNIGHT_IST)).toBe(false)
  })
})

describe('readiness and controls', () => {
  test('reports reasons and blocks start without a provider', () => {
    const status = outreachStatus(db, campaignId, { now: NOON_IST, providerConfigured: false })
    expect(status.reasons).toEqual(['provider_not_configured'])
    expect(status.counts.readyContacts).toBe(2)
    expect(() => startOutreach(db, campaignId, false)).toThrow('provider_not_configured')
  })

  test('start outside hours is allowed; pause and stop change status', () => {
    expect(outreachStatus(db, campaignId, { now: MIDNIGHT_IST, providerConfigured: true }).canStart).toBe(true)
    expect(startOutreach(db, campaignId, true).status).toBe('running')
    expect(pauseOutreach(db, campaignId).status).toBe('paused')
    expect(startOutreach(db, campaignId, true).status).toBe('running')
    expect(stopOutreach(db, campaignId).status).toBe('completed')
  })
})

describe('scheduler tick', () => {
  test('dials ready contacts inside hours, nothing outside, and never twice while active', async () => {
    startOutreach(db, campaignId, true)
    expect((await tick(db, provider, { now: MIDNIGHT_IST })).dialed).toBe(0)
    const inside = await tick(db, provider, { now: NOON_IST })
    expect(inside.dialed).toBe(2)
    expect(provider.created.map((c) => c.phone).sort()).toEqual(['+919876543210', '+919876543211'])
    expect(provider.created[0]?.region).toBe('IN')
    expect(provider.created[0]?.recipientResultSchema).toHaveProperty('properties')
    expect(provider.created[0]?.idempotencyKey).toMatch(/^tokito-/)
    expect((await tick(db, provider, { now: NOON_IST + 1000 })).dialed).toBe(0)
    const contacts = listContacts(db, campaignId).contacts
    expect(contacts[0]?.lastCall).toMatchObject({ attempts: 1, lastStatus: 'dialing' })
  })

  test('paused campaigns and reached budgets do not dial', async () => {
    updateCampaign(db, campaignId, { maxCalls: 1 })
    startOutreach(db, campaignId, true)
    expect((await tick(db, provider, { now: NOON_IST })).dialed).toBe(1)
    pauseOutreach(db, campaignId)
    updateCampaign(db, campaignId, { maxCalls: null })
    expect((await tick(db, provider, { now: NOON_IST })).dialed).toBe(0)
  })

  test('provider errors such as unsupported_region are recorded on the call', async () => {
    provider.failWith = new ProviderError('unsupported_region', 'Region not supported', 400)
    startOutreach(db, campaignId, true)
    const result = await tick(db, provider, { now: NOON_IST })
    expect(result.failed).toBe(2)
    const rows = db.select().from(calls).all()
    expect(rows.every((call) => call.status === 'failed' && call.failureCode === 'unsupported_region')).toBe(true)
    expect(listContacts(db, campaignId).contacts[0]?.lastCall?.lastFailureCode).toBe('unsupported_region')
  })
})

describe('webhooks and retries', () => {
  test('a completed event stores transcript and answers; a duplicate changes nothing', async () => {
    startOutreach(db, campaignId, true)
    await tick(db, provider, { now: NOON_IST })
    const call = db.select().from(calls).where(eq(calls.providerCallId, 'calle_1')).get()!
    const event = { id: 'evt_1', type: 'call.completed', data: completedTask('calle_1', provider.created[0]!.phone) }
    expect(handleWebhookEvent(db, event)).toMatchObject({ duplicate: false, matched: true, callId: call.id })
    const stored = getCall(db, campaignId, call.id)
    expect(stored.status).toBe('completed')
    expect(stored.turns.map((t) => `${t.speaker}:${t.text}`)).toEqual(['assistant:Hello, this is Tokito.', 'person:Hi.'])
    expect(stored.answers.map((a) => a.value)).toEqual(['Yes', 'Bit pricey'])
    expect(stored.durationSeconds).toBe(180)
    expect(handleWebhookEvent(db, event)).toMatchObject({ duplicate: true })
    expect(getCall(db, campaignId, call.id).answers).toHaveLength(2)
    expect(handleWebhookEvent(db, { ...event, id: 'evt_x', data: { ...event.data, id: 'unknown' } })).toMatchObject({ matched: false })
  })

  test('no_answer retries after the delay, then stops at the attempt limit', async () => {
    startOutreach(db, campaignId, true)
    await tick(db, provider, { now: NOON_IST })
    const failed = (id: string, phone: string) => completedTask(id, phone, { status: 'failed', recipients: [{ id: 'rcp_1', phones: [phone], status: 'failed', structured_result: null, summary: null, attempts: [{ id: 'att', phone, status: 'failed', started_at: null, completed_at: null, summary: null, transcript_turns: [], provider_call_id: null, failure_code: 'no_answer', failure_message: 'No answer' }] }] })
    handleWebhookEvent(db, { id: 'evt_a', type: 'call.failed', data: failed('calle_1', provider.created[0]!.phone) }, NOON_IST)
    handleWebhookEvent(db, { id: 'evt_b', type: 'call.failed', data: failed('calle_2', provider.created[1]!.phone) }, NOON_IST)
    expect(db.select().from(calls).all().map((c) => c.status)).toEqual(['no_answer', 'no_answer'])
    expect((await tick(db, provider, { now: NOON_IST + 10 * 60_000 })).dialed).toBe(0)
    const later = NOON_IST + 3 * 60 * 60_000
    expect((await tick(db, provider, { now: later })).dialed).toBe(2)
    handleWebhookEvent(db, { id: 'evt_c', type: 'call.failed', data: failed('calle_3', provider.created[2]!.phone) }, later)
    handleWebhookEvent(db, { id: 'evt_d', type: 'call.failed', data: failed('calle_4', provider.created[3]!.phone) }, later)
    expect((await tick(db, provider, { now: later + 3 * 60 * 60_000 })).dialed).toBe(0)
    const status = outreachStatus(db, campaignId, { now: later, providerConfigured: true })
    expect(status.counts.unreachable).toBe(2)
    expect(status.counts.remaining).toBe(0)
  })

  test('opt-out on a call lands on the opt-out list and marks the contact', async () => {
    startOutreach(db, campaignId, true)
    await tick(db, provider, { now: NOON_IST })
    const phone = provider.created[0]!.phone
    const task = completedTask('calle_1', phone)
    task.recipients[0]!.structured_result = { ...task.recipients[0]!.structured_result!, outcome: 'opted_out', opt_out: 'yes' }
    handleWebhookEvent(db, { id: 'evt_o', type: 'call.completed', data: task })
    expect(db.select().from(optOuts).all().map((row) => row.phone)).toEqual([phone])
    expect(listContacts(db, campaignId).contacts.find((c) => c.phone === phone)?.status).toBe('opted_out')
  })

  test('callbacks are dialed at the scheduled time even outside hours', async () => {
    startOutreach(db, campaignId, true)
    await tick(db, provider, { now: NOON_IST })
    const phone = provider.created[0]!.phone
    const task = completedTask('calle_1', phone)
    task.recipients[0]!.structured_result = { ...task.recipients[0]!.structured_result!, outcome: 'callback_requested', callback: { requested: 'yes', preferred_time: 'tomorrow evening' } }
    handleWebhookEvent(db, { id: 'evt_cb', type: 'call.completed', data: task })
    const source = db.select().from(calls).where(eq(calls.providerCallId, 'calle_1')).get()!
    expect(source.status).toBe('callback_requested')
    const at = Date.now() + 60 * 60_000
    const scheduled = scheduleCallback(db, campaignId, source.id, at)
    expect(scheduled).toMatchObject({ status: 'queued', scheduledAt: at, attempt: 2 })
    expect((await tick(db, provider, { now: at - 1000 })).dialed).toBe(0)
    expect((await tick(db, provider, { now: at + 1000 })).dialed).toBe(1)
    expect(provider.created.at(-1)?.phone).toBe(phone)
  })

  test('polling applies a terminal task when the webhook is missed', async () => {
    startOutreach(db, campaignId, true)
    await tick(db, provider, { now: NOON_IST })
    provider.tasks.set('calle_1', completedTask('calle_1', provider.created[0]!.phone))
    const result = await tick(db, provider, { now: NOON_IST + 5 * 60_000 })
    expect(result.polled).toBeGreaterThanOrEqual(1)
    expect(db.select().from(calls).where(eq(calls.providerCallId, 'calle_1')).get()?.status).toBe('completed')
    expect(db.select().from(campaigns).where(eq(campaigns.id, campaignId)).get()?.status).toBe('running')
  })
})
