import { beforeEach, describe, expect, test } from 'bun:test'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { createDb, type Db } from '../db'
import { answers, calls } from '../db/schema'
import { createCampaign, listCampaigns, replaceQuestions } from '../services/campaigns'
import { commitImport, createImport, listContacts } from '../services/contacts'
import { parseSpreadsheet } from '../services/spreadsheet'
import { buildExportFile, buildExportRows } from './export'
import { campaignResults } from './results'

let db: Db
let campaignId: string
let qids: string[]
let contactIds: string[]

function insertCall(input: { contactId: string | null; status: 'completed' | 'no_answer' | 'declined' | 'callback_requested'; provider?: 'calle' | 'simulator'; endedAt: number; personName?: string; answers?: [status: 'answered' | 'skipped' | 'declined', value: string | null, valueNumber?: number | null][] }) {
  const id = crypto.randomUUID()
  db.insert(calls).values({
    id, campaignId, contactId: input.contactId, personName: input.personName ?? null, provider: input.provider ?? 'calle', providerCallId: input.provider === 'simulator' ? null : `p_${id}`, attempt: 1,
    status: input.status, task: 't', resultSchema: {}, questionMap: {}, startedAt: input.endedAt - 120_000, endedAt: input.endedAt, durationSeconds: 120, createdAt: input.endedAt - 120_000, updatedAt: input.endedAt,
  }).run()
  input.answers?.forEach(([status, value, valueNumber], index) => {
    db.insert(answers).values({ id: crypto.randomUUID(), callId: id, campaignId, contactId: input.contactId, questionId: qids[index]!, questionText: `Q${index + 1}`, status, value, valueNumber: valueNumber ?? null, notes: null, createdAt: input.endedAt }).run()
  })
  return id
}

beforeEach(() => {
  db = createDb(':memory:')
  migrate(db, { migrationsFolder: './drizzle' })
  campaignId = createCampaign(db, { name: 'Menu', goal: 'Feedback', questionSource: 'manual', conversationMode: 'dynamic', questions: ['x'] }).id
  qids = replaceQuestions(db, campaignId, {
    questions: [
      { text: 'Tried the menu?', type: 'choice', options: ['Yes', 'No'], required: true, source: 'manual' },
      { text: 'Rate the portions', type: 'rating', options: [], required: true, source: 'manual' },
      { text: 'Anything else?', type: 'open', options: [], required: false, source: 'manual' },
    ],
  }).questions.map((q) => q.id)
  const preview = createImport(db, campaignId, 'c.csv', new TextEncoder().encode('Name,Phone\nAsha,9876543210\nRavi,9876543211\nMeera,9876543212\nDev,9876543213\n'))
  commitImport(db, campaignId, preview.id)
  contactIds = listContacts(db, campaignId).contacts.map((c) => c.id)
  const t = Date.UTC(2026, 8, 14, 7, 0)
  // Asha: an early completed call, then a later completed callback: only the latest counts.
  insertCall({ contactId: contactIds[0]!, status: 'completed', endedAt: t, answers: [['answered', 'Yes'], ['answered', '3', 3], ['skipped', null]] })
  insertCall({ contactId: contactIds[0]!, status: 'completed', endedAt: t + 3_600_000, answers: [['answered', 'yes'], ['answered', '5', 5], ['answered', 'More vegetarian mains']] })
  // Ravi: declined. Meera: two no-answers (max attempts 2 → unreachable). Dev: callback requested.
  insertCall({ contactId: contactIds[1]!, status: 'declined', endedAt: t })
  insertCall({ contactId: contactIds[2]!, status: 'no_answer', endedAt: t })
  insertCall({ contactId: contactIds[2]!, status: 'no_answer', endedAt: t + 1000 })
  insertCall({ contactId: contactIds[3]!, status: 'callback_requested', endedAt: t })
  // A text simulation without a contact counts as one more response.
  insertCall({ contactId: null, personName: 'Tester', provider: 'simulator', status: 'completed', endedAt: t, answers: [['answered', 'No'], ['declined', null], ['answered', 'Nothing']] })
})

describe('campaign results', () => {
  test('participation is people-based and matches the fixture', () => {
    const { participation, responses } = campaignResults(db, campaignId)
    expect(participation).toEqual({ people: 4, ready: 4, called: 4, reached: 3, completed: 1, callbacks: 1, declined: 1, optedOut: 0, unreachable: 1 })
    expect(responses).toEqual({ total: 2, simulated: 1 })
  })

  test('per-question aggregates use the latest completed call per person', () => {
    const { questions } = campaignResults(db, campaignId)
    expect(questions[0]?.choice).toEqual({ totals: [{ option: 'Yes', count: 1 }, { option: 'No', count: 1 }], other: 0 })
    expect(questions[1]?.rating).toEqual({ average: 5, distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 1 } })
    expect(questions[1]?.statusCounts).toMatchObject({ answered: 1, declined: 1, missing: 0 })
    expect(questions[2]?.answers.map((a) => a.value)).toEqual(['Nothing', 'More vegetarian mains'])
    expect(questions[2]?.answers.every((a) => a.callId)).toBe(true)
  })

  test('home list counts contacts, ready, and responses', () => {
    expect(listCampaigns(db).find((c) => c.id === campaignId)).toMatchObject({ contactCount: 4, readyCount: 4, responseCount: 2 })
  })

  test('contact summary links to the latest call', () => {
    const asha = listContacts(db, campaignId).contacts[0]!
    expect(asha.lastCall?.latestCallId).toBeDefined()
    expect(asha.lastCall?.attempts).toBe(2)
  })
})

describe('exports', () => {
  test('answers export has one row per response and re-imports through the parser', () => {
    const { headers, rows } = buildExportRows(db, campaignId, 'answers')
    expect(headers.slice(12)).toEqual(['Q1: Tried the menu?', 'Q1 status', 'Q1 notes', 'Q2: Rate the portions', 'Q2 status', 'Q2 notes', 'Q3: Anything else?', 'Q3 status', 'Q3 notes'])
    expect(rows).toHaveLength(2)
    const file = buildExportFile(db, campaignId, 'answers', 'csv')
    const parsed = parseSpreadsheet(new TextEncoder().encode(file.body as string))
    expect(parsed.headers).toEqual(headers)
    expect(parsed.rows).toHaveLength(2)
    expect(parsed.rows.find((row) => row[0] === 'Asha')?.[15]).toBe('5')
    const xlsx = buildExportFile(db, campaignId, 'answers', 'xlsx')
    expect(parseSpreadsheet(xlsx.body as Uint8Array).rows).toHaveLength(2)
  })

  test('calls export lists every call with its status', () => {
    const { rows } = buildExportRows(db, campaignId, 'calls')
    expect(rows).toHaveLength(7)
    expect(rows.map((row) => row[3]).sort()).toEqual(['callback_requested', 'completed', 'completed', 'completed', 'declined', 'no_answer', 'no_answer'])
  })
})
