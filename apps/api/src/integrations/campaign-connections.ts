import { and, eq } from 'drizzle-orm'
import type { Db } from '../db'
import { campaignConnections, campaignEvents, campaigns, type CampaignConnectionKind } from '../db/schema'
import { NotFoundError } from '../services/campaigns'

const id = () => crypto.randomUUID()

export class ConnectionConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConnectionConfigError'
  }
}

export function parseSpreadsheetId(input: string) {
  const trimmed = input.trim()
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (match) return match[1]!
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed
  throw new ConnectionConfigError('Paste the full Google Sheets URL, for example https://docs.google.com/spreadsheets/d/…/edit.')
}

export function parseNotionPageId(input: string) {
  const compact = input.trim().replace(/-/g, '')
  const match = compact.match(/([0-9a-fA-F]{32})(?:[?#].*)?$/)
  if (!match) throw new ConnectionConfigError('Paste a Notion page URL or id; the id is the 32 characters at the end of the page link.')
  const raw = match[1]!.toLowerCase()
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`
}

export function listCampaignConnections(db: Db, campaignId: string) {
  if (!db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.id, campaignId)).get()) throw new NotFoundError('Campaign not found')
  return db.select().from(campaignConnections).where(eq(campaignConnections.campaignId, campaignId)).all()
}

export function getCampaignConnection(db: Db, campaignId: string, kind: CampaignConnectionKind) {
  return db.select().from(campaignConnections).where(and(eq(campaignConnections.campaignId, campaignId), eq(campaignConnections.kind, kind))).get() ?? null
}

export function setCampaignConnection(db: Db, campaignId: string, kind: CampaignConnectionKind, input: { config?: Record<string, string>; enabled?: boolean }) {
  if (!db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.id, campaignId)).get()) throw new NotFoundError('Campaign not found')
  const existing = getCampaignConnection(db, campaignId, kind)
  const now = Date.now()
  const row = {
    id: existing?.id ?? id(),
    campaignId,
    kind,
    config: input.config ?? existing?.config ?? {},
    enabled: input.enabled ?? existing?.enabled ?? true,
    lastSyncAt: existing?.lastSyncAt ?? null,
    lastStatus: existing?.lastStatus ?? null,
    lastError: existing?.lastError ?? null,
    lastExternalUrl: existing?.lastExternalUrl ?? null,
    updatedAt: now,
  }
  db.insert(campaignConnections).values(row).onConflictDoUpdate({ target: [campaignConnections.campaignId, campaignConnections.kind], set: row }).run()
  return row
}

export function removeCampaignConnection(db: Db, campaignId: string, kind: CampaignConnectionKind) {
  db.delete(campaignConnections).where(and(eq(campaignConnections.campaignId, campaignId), eq(campaignConnections.kind, kind))).run()
}

// Records the outcome of one integration write where the dashboard and Discord can see it.
export function recordSync(db: Db, campaignId: string, kind: CampaignConnectionKind, result: { ok: true; externalUrl?: string | null; detail?: Record<string, unknown> } | { ok: false; error: string; detail?: Record<string, unknown> }) {
  const now = Date.now()
  const existing = getCampaignConnection(db, campaignId, kind)
  if (existing) {
    db.update(campaignConnections)
      .set({ lastSyncAt: now, lastStatus: result.ok ? 'ok' : 'failed', lastError: result.ok ? null : result.error, lastExternalUrl: result.ok ? (result.externalUrl ?? existing.lastExternalUrl) : existing.lastExternalUrl, updatedAt: now })
      .where(eq(campaignConnections.id, existing.id))
      .run()
  }
  db.insert(campaignEvents)
    .values({ id: id(), campaignId, type: `integration.${kind}.${result.ok ? 'ok' : 'failed'}`, payload: { ...(result.detail ?? {}), ...(result.ok ? { url: result.externalUrl ?? null } : { error: result.error }) }, createdAt: now })
    .run()
}
