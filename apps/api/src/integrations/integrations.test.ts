import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { createDb, type Db } from '../db'
import { answers, calls, campaignEvents, connections, reports } from '../db/schema'
import { createCampaign, replaceQuestions } from '../services/campaigns'
import { commitImport, createImport, listContacts } from '../services/contacts'
import { scheduleCallback, startOutreach } from '../calls/scheduler'
import { persistCallResult } from '../calls/persist'
import { setIntegrationFetch } from './http'
import { accessToken, beginOAuth, completeOAuth, consumeState, listConnections } from './connections'
import { integrationConfig } from './config'
import { getCampaignConnection, parseNotionPageId, parseSpreadsheetId, setCampaignConnection } from './campaign-connections'
import { buildSheetValues, importContactsFromSheet, syncResultsToSheet } from './sheets'
import { createCallbackEvent, updateCallbackEvent } from './calendar'
import { buildReportBlocks, publishReportToNotion } from './notion'
import { emitHook, onHook, resetHooks } from './hooks'
import { registerIntegrations } from './register'
import type { ReportContent } from '../reports/generate'

type Recorded = { method: string; url: string; body?: unknown }

function fakeNetwork(routes: (req: Recorded) => { status?: number; body: unknown } | null) {
  const requests: Recorded[] = []
  setIntegrationFetch(async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const method = init?.method ?? 'GET'
    const raw = typeof init?.body === 'string' ? init.body : undefined
    let body: unknown = raw
    if (raw && raw.startsWith('{')) body = JSON.parse(raw)
    const record = { method, url, body }
    requests.push(record)
    const result = routes(record) ?? { status: 404, body: { error: { message: `no route for ${method} ${url}` } } }
    return new Response(JSON.stringify(result.body), { status: result.status ?? 200, headers: { 'content-type': 'application/json' } })
  })
  return requests
}

let db: Db
let campaignId: string

beforeEach(() => {
  db = createDb(':memory:')
  migrate(db, { migrationsFolder: './drizzle' })
  resetHooks()
  integrationConfig.google = { clientId: 'gid', clientSecret: 'gsecret' }
  integrationConfig.notion = { clientId: 'nid', clientSecret: 'nsecret' }
  campaignId = createCampaign(db, { name: 'Menu', goal: 'Menu views', questionSource: 'manual', conversationMode: 'dynamic', questions: ['Prices?'] }).id
  db.insert(connections).values({ provider: 'google', accessToken: 'g-token', refreshToken: 'g-refresh', expiresAt: Date.now() + 3_600_000, scope: null, accountLabel: 'asha@example.com', createdAt: 1, updatedAt: 1 }).run()
  db.insert(connections).values({ provider: 'notion', accessToken: 'n-token', refreshToken: null, expiresAt: null, scope: null, accountLabel: 'Tokito workspace', createdAt: 1, updatedAt: 1 }).run()
})

afterEach(() => setIntegrationFetch(null))

describe('OAuth', () => {
  test('start builds provider URLs with state; callback exchanges the code and stores a labeled connection', async () => {
    db.delete(connections).run()
    const google = beginOAuth('google', 'http://web/connections', 1000)
    expect(google.url).toContain('accounts.google.com')
    expect(google.url).toContain('access_type=offline')
    expect(consumeState(google.state, 2000).returnTo).toBe('http://web/connections')
    expect(() => consumeState(google.state, 2000)).toThrow('expired')
    fakeNetwork((req) => {
      if (req.url === 'https://oauth2.googleapis.com/token') return { body: { access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600, scope: 's' } }
      if (req.url.includes('userinfo')) return { body: { email: 'asha@example.com' } }
      return null
    })
    const saved = await completeOAuth(db, 'google', 'code-1', 5000)
    expect(saved).toMatchObject({ provider: 'google', accountLabel: 'asha@example.com' })
    expect(listConnections(db).find((c) => c.provider === 'google')).toMatchObject({ connected: true, configured: true, accountLabel: 'asha@example.com' })
    expect(listConnections(db).find((c) => c.provider === 'notion')?.connected).toBe(false)
  })

  test('expired Google tokens are refreshed once and stored', async () => {
    db.update(connections).set({ expiresAt: Date.now() - 1000 }).where(eq(connections.provider, 'google')).run()
    const requests = fakeNetwork((req) => (req.url === 'https://oauth2.googleapis.com/token' ? { body: { access_token: 'refreshed', expires_in: 3600 } } : null))
    expect(await accessToken(db, 'google')).toBe('refreshed')
    expect(String(requests[0]?.body)).toContain('grant_type=refresh_token')
    expect(await accessToken(db, 'google')).toBe('refreshed')
    expect(requests).toHaveLength(1)
  })
})

describe('campaign connection config', () => {
  test('parses sheet and Notion identifiers from pasted URLs', () => {
    expect(parseSpreadsheetId('https://docs.google.com/spreadsheets/d/1AbC_dEf-123456789012345/edit#gid=0')).toBe('1AbC_dEf-123456789012345')
    expect(() => parseSpreadsheetId('not a sheet')).toThrow('Google Sheets URL')
    expect(parseNotionPageId('https://www.notion.so/team/Menu-report-0123456789abcdef0123456789abcdef?pvs=4')).toBe('01234567-89ab-cdef-0123-456789abcdef')
    expect(() => parseNotionPageId('https://www.notion.so/team')).toThrow('Notion page')
    const row = setCampaignConnection(db, campaignId, 'sheets', { config: { spreadsheetId: 'sheet-1' } })
    expect(getCampaignConnection(db, campaignId, 'sheets')?.id).toBe(row.id)
  })
})

describe('Google Sheets', () => {
  test('imports contacts from the first tab through the normal import flow', async () => {
    setCampaignConnection(db, campaignId, 'sheets', { config: { spreadsheetId: 'sheet-1' } })
    fakeNetwork((req) => {
      if (req.url.endsWith('/sheet-1?fields=sheets.properties.title')) return { body: { sheets: [{ properties: { title: 'Members' } }] } }
      if (req.url.includes('/values/Members?')) return { body: { values: [['Name', 'Phone'], ['Asha', '9876543210'], ['', '']] } }
      return null
    })
    const preview = await importContactsFromSheet(db, campaignId)
    expect(preview).toMatchObject({ fileName: 'Members (Google Sheet)', headers: ['Name', 'Phone'], rowCount: 1, suggestedMapping: { nameColumn: 0, phoneColumn: 1 } })
    const summary = commitImport(db, campaignId, preview.id, preview.suggestedMapping as { nameColumn: number | null; phoneColumn: number; contextColumns: number[] })
    expect(summary.counts.ready).toBe(1)
    expect(getCampaignConnection(db, campaignId, 'sheets')).toMatchObject({ lastStatus: 'ok', lastExternalUrl: 'https://docs.google.com/spreadsheets/d/sheet-1' })
  })

  test('writes answers and calls tabs from the export rows and records failures', async () => {
    setCampaignConnection(db, campaignId, 'sheets', { config: { spreadsheetId: 'sheet-1' } })
    const requests = fakeNetwork((req) => {
      if (req.url.endsWith(':batchUpdate')) return { status: 400, body: { error: { message: 'A sheet with the name "Tokito answers" already exists.' } } }
      return { body: {} }
    })
    const url = await syncResultsToSheet(db, campaignId)
    expect(url).toBe('https://docs.google.com/spreadsheets/d/sheet-1')
    const puts = requests.filter((r) => r.method === 'PUT')
    expect(puts.map((r) => decodeURIComponent(r.url).includes('Tokito answers!A1') || decodeURIComponent(r.url).includes('Tokito calls!A1'))).toEqual([true, true])
    expect((puts[0]?.body as { values: unknown[][] }).values[0]).toEqual(buildSheetValues(db, campaignId).answers[0] as unknown[])
    expect(getCampaignConnection(db, campaignId, 'sheets')?.lastStatus).toBe('ok')
    fakeNetwork(() => ({ status: 403, body: { error: { message: 'The caller does not have permission' } } }))
    await expect(syncResultsToSheet(db, campaignId)).rejects.toThrow('permission')
    expect(getCampaignConnection(db, campaignId, 'sheets')).toMatchObject({ lastStatus: 'failed', lastError: 'The caller does not have permission' })
    expect(db.select().from(campaignEvents).all().map((e) => e.type)).toContain('integration.sheets.failed')
  })
})

describe('Google Calendar', () => {
  test('a scheduled callback creates an event and the terminal call updates it', async () => {
    setCampaignConnection(db, campaignId, 'calendar', { config: {} })
    const preview = createImport(db, campaignId, 'c.csv', new TextEncoder().encode('Name,Phone\nAsha,9876543210\n'))
    commitImport(db, campaignId, preview.id, { nameColumn: 0, phoneColumn: 1, contextColumns: [] })
    const contact = listContacts(db, campaignId).contacts[0]!
    const source = crypto.randomUUID()
    db.insert(calls).values({ id: source, campaignId, contactId: contact.id, provider: 'calle', providerCallId: 'p1', attempt: 1, status: 'callback_requested', task: 't', resultSchema: {}, questionMap: {}, callbackRequested: true, callbackTime: 'tomorrow', createdAt: 1, updatedAt: 1 }).run()
    const requests = fakeNetwork((req) => {
      if (req.method === 'POST' && req.url.endsWith('/events')) return { body: { id: 'evt-1', htmlLink: 'https://calendar.google.com/event?eid=1' } }
      if (req.method === 'GET') return { body: { summary: 'Tokito callback: Asha (Menu)' } }
      if (req.method === 'PATCH') return { body: {} }
      return null
    })
    registerIntegrations()
    const at = Date.now() + 3_600_000
    const scheduled = scheduleCallback(db, campaignId, source, at)
    await new Promise((resolve) => setTimeout(resolve, 10))
    const created = requests.find((r) => r.method === 'POST')!
    expect((created.body as { summary: string; start: { dateTime: string; timeZone: string } }).summary).toBe('Tokito callback: Asha (Menu)')
    expect((created.body as { start: { timeZone: string } }).start.timeZone).toBe('Asia/Kolkata')
    expect(db.select().from(calls).where(eq(calls.id, scheduled.id)).get()?.calendarEventId).toBe('evt-1')
    const fresh = db.select().from(calls).where(eq(calls.id, scheduled.id)).get()!
    persistCallResult(db, { ...fresh, providerCallId: 'p2' }, { structured: null, status: 'completed', eventType: 'test.terminal' })
    await new Promise((resolve) => setTimeout(resolve, 10))
    const patched = requests.find((r) => r.method === 'PATCH')!
    expect((patched.body as { summary: string }).summary).toBe('Tokito callback: Asha (Menu) (done)')
    expect(getCampaignConnection(db, campaignId, 'calendar')?.lastStatus).toBe('ok')
  })

  test('calendar failures are recorded, never thrown into the scheduler', async () => {
    setCampaignConnection(db, campaignId, 'calendar', { config: {} })
    db.insert(calls).values({ id: 'cb', campaignId, contactId: null, provider: 'calle', attempt: 1, status: 'queued', task: 't', resultSchema: {}, questionMap: {}, scheduledAt: Date.now() + 1000, createdAt: 1, updatedAt: 1 }).run()
    fakeNetwork(() => ({ status: 401, body: { error: { message: 'Invalid Credentials' } } }))
    expect(await createCallbackEvent(db, 'cb')).toBeNull()
    expect(getCampaignConnection(db, campaignId, 'calendar')).toMatchObject({ lastStatus: 'failed', lastError: 'Invalid Credentials' })
    expect(await updateCallbackEvent(db, 'cb')).toBe(false)
  })
})

describe('Notion', () => {
  const content: ReportContent = {
    headline: 'Prices felt high to some.',
    themes: [{ title: 'Price', kind: 'problem', description: 'One person found it expensive.', peopleCount: 1, quotes: [{ evidenceId: 'e1', answerId: 'a1', callId: 'call-1', person: 'Asha', simulated: false, questionText: 'Prices?', status: 'answered', value: 'Too expensive', notes: null }] }],
    disagreements: [],
    requests: [],
    nextSteps: [{ suggestion: 'Review pricing.', quotes: [] }],
    gaps: [{ questionId: 'q', questionText: 'Prices?', skipped: 1, declined: 0, unknown: 0, notAsked: 0, missing: 0 }],
    participation: { people: 2, ready: 2, called: 2, reached: 1, completed: 1, callbacks: 0, declined: 0, optedOut: 0, unreachable: 1 },
    responses: { total: 1, simulated: 0 },
    questions: [],
    droppedCitations: 0,
  }

  test('blocks keep quotes as quotes with links and label AI text', () => {
    const blocks = buildReportBlocks(content, campaignId, 'http://web')
    const json = JSON.stringify(blocks)
    expect(json).toContain('AI summary: Prices felt high to some.')
    expect(json).toContain('“Too expensive”')
    expect(json).toContain(`http://web/survey/${campaignId}/calls/call-1`)
    expect(json).toContain('Suggested next steps (AI suggestions)')
    expect(json).toContain('Prices?: 1 skipped')
    expect(blocks.filter((b) => b.type === 'quote')).toHaveLength(1)
  })

  test('publishing creates a page under the configured parent and stores its URL', async () => {
    setCampaignConnection(db, campaignId, 'notion', { config: { parentPageId: '01234567-89ab-cdef-0123-456789abcdef' } })
    db.insert(reports).values({ id: 'r1', campaignId, version: 1, model: 'fake', promptVersion: 'v', content: content as unknown as Record<string, unknown>, createdAt: 1 }).run()
    const requests = fakeNetwork((req) => (req.url === 'https://api.notion.com/v1/pages' ? { body: { id: 'page-1', url: 'https://notion.so/page-1' } } : null))
    expect(await publishReportToNotion(db, campaignId, 1, 'http://web')).toBe('https://notion.so/page-1')
    const body = requests[0]?.body as { parent: { page_id: string }; properties: { title: { title: { text: { content: string } }[] } } }
    expect(body.parent.page_id).toBe('01234567-89ab-cdef-0123-456789abcdef')
    expect(body.properties.title.title[0]?.text.content).toBe('Menu — Tokito report v1')
    expect(db.select().from(reports).where(eq(reports.id, 'r1')).get()?.externalUrl).toBe('https://notion.so/page-1')
    fakeNetwork(() => ({ status: 404, body: { message: 'Could not find page' } }))
    await expect(publishReportToNotion(db, campaignId, 1, 'http://web')).rejects.toThrow('Could not find page')
    expect(getCampaignConnection(db, campaignId, 'notion')?.lastStatus).toBe('failed')
  })
})

describe('hooks', () => {
  test('handlers run and a failing handler does not break the others', async () => {
    const seen: string[] = []
    onHook('call.terminal', () => { throw new Error('boom') })
    onHook('call.terminal', ({ callId }) => { seen.push(callId) })
    await emitHook('call.terminal', { db, campaignId, callId: 'x' })
    expect(seen).toEqual(['x'])
  })
})
