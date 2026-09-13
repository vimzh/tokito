import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { createDb, type Db } from './db'
import { calls, campaignEvents, campaigns, connections, contacts } from './db/schema'
import { createCampaign } from './services/campaigns'
import { commitImport, createImport } from './services/contacts'
import { updateSettings } from './services/settings'
import { applyRetention, purgeCampaignData } from './services/purge'
import { decryptSecret, encryptSecret, setEncryptionKey } from './integrations/crypto'
import { accessToken } from './integrations/connections'

process.env.NODE_ENV = 'test'
process.env.API_TOKEN = 'secret-token'
process.env.DB_FILE_NAME = ':memory:'

let app: typeof import('./index').app
let db: Db

beforeAll(async () => {
  ;({ app } = await import('./index'))
  ;({ db } = await import('./db'))
  migrate(db, { migrationsFolder: './drizzle' })
})

afterAll(() => {
  delete process.env.API_TOKEN
})

const auth = { Authorization: 'Bearer secret-token' }

describe('API access', () => {
  test('health and webhooks are public; everything else needs the token', async () => {
    expect((await app.request('/api/health')).status).toBe(200)
    expect((await app.request('/api/campaigns')).status).toBe(401)
    expect((await app.request('/api/campaigns', { headers: { Authorization: 'Bearer wrong' } })).status).toBe(401)
    expect((await app.request('/api/campaigns', { headers: auth })).status).toBe(200)
    const hook = await app.request('/api/webhooks/calle', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'evt_t', type: 'call.completed', data: { id: 'x', status: 'completed', recipients: [] } }) })
    expect(hook.status).toBe(200)
  })

  test('validation errors and unknown ids keep their shape through the app', async () => {
    const bad = await app.request('/api/campaigns', { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: '{}' })
    expect(bad.status).toBe(400)
    expect(((await bad.json()) as { error: { issues: unknown[] } }).error.issues.length).toBeGreaterThan(0)
    expect((await app.request('/api/campaigns/nope', { headers: auth })).status).toBe(404)
  })
})

describe('deletion and retention', () => {
  test('purge removes collected data, keeps the campaign, and logs the deletion', async () => {
    const campaign = createCampaign(db, { name: 'Purge me', goal: 'g', questionSource: 'manual', conversationMode: 'dynamic', questions: ['q'] })
    const preview = createImport(db, campaign.id, 'c.csv', new TextEncoder().encode('Name,Phone\nAsha,9876543210\n'))
    commitImport(db, campaign.id, preview.id, { nameColumn: 0, phoneColumn: 1, contextColumns: [] })
    db.insert(calls).values({ id: 'call-p', campaignId: campaign.id, contactId: null, provider: 'simulator', attempt: 1, status: 'completed', task: 't', resultSchema: {}, questionMap: {}, createdAt: 1, updatedAt: 1 }).run()
    const response = await app.request(`/api/campaigns/${campaign.id}/purge`, { method: 'POST', headers: auth })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ contacts: 1, imports: 1, calls: 1 })
    expect(db.select().from(contacts).where(eq(contacts.campaignId, campaign.id)).all()).toHaveLength(0)
    expect(db.select().from(calls).where(eq(calls.campaignId, campaign.id)).all()).toHaveLength(0)
    expect(db.select().from(campaigns).where(eq(campaigns.id, campaign.id)).get()?.purgedAt).not.toBeNull()
    expect(db.select().from(campaignEvents).where(eq(campaignEvents.campaignId, campaign.id)).all().some((e) => e.type === 'data.purged')).toBe(true)
    const detail = await app.request(`/api/campaigns/${campaign.id}`, { headers: auth })
    expect(detail.status).toBe(200)
  })

  test('retention purges only completed campaigns older than the limit', () => {
    const old = createCampaign(db, { name: 'Old', goal: 'g', questionSource: 'ai', conversationMode: 'dynamic' })
    const fresh = createCampaign(db, { name: 'Fresh', goal: 'g', questionSource: 'ai', conversationMode: 'dynamic' })
    const now = Date.now()
    db.update(campaigns).set({ status: 'completed', updatedAt: now - 40 * 86_400_000 }).where(eq(campaigns.id, old.id)).run()
    db.update(campaigns).set({ status: 'completed', updatedAt: now - 2 * 86_400_000 }).where(eq(campaigns.id, fresh.id)).run()
    expect(applyRetention(db, now)).toEqual([])
    updateSettings(db, { retentionDays: 30 })
    const purged = applyRetention(db, now)
    expect(purged.map((p) => p.campaignId)).toEqual([old.id])
    expect(applyRetention(db, now)).toEqual([])
    expect(() => purgeCampaignData(db, 'nope', 'manual')).toThrow('not found')
  })
})

describe('token encryption', () => {
  test('round-trips with a key, reads legacy plaintext, and refuses without the key', async () => {
    setEncryptionKey('test-key')
    const sealed = encryptSecret('tok-123')
    expect(sealed.startsWith('enc:v1:')).toBe(true)
    expect(decryptSecret(sealed)).toBe('tok-123')
    expect(decryptSecret('plain')).toBe('plain')
    db.insert(connections).values({ provider: 'notion', accessToken: sealed, refreshToken: null, expiresAt: null, scope: null, accountLabel: null, createdAt: 1, updatedAt: 1 }).run()
    expect(await accessToken(db, 'notion')).toBe('tok-123')
    setEncryptionKey(null)
    expect(() => decryptSecret(sealed)).toThrow('TOKEN_ENCRYPTION_KEY')
    db.delete(connections).run()
  })
})
