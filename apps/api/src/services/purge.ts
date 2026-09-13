import { and, eq, isNull, lt } from 'drizzle-orm'
import type { Db } from '../db'
import { calls, campaignEvents, campaigns, contactImports, contacts } from '../db/schema'
import { NotFoundError } from './campaigns'
import { getSettings } from './settings'

// Deletes everything collected for a campaign (contacts, imports, calls with transcripts and answers).
// The campaign, its questions, its reports, and the event log stay so counts and findings remain readable.
export function purgeCampaignData(db: Db, campaignId: string, reason: 'manual' | 'retention', now = Date.now()) {
  const campaign = db.select().from(campaigns).where(eq(campaigns.id, campaignId)).get()
  if (!campaign) throw new NotFoundError('Campaign not found')
  const counts = db.transaction((tx) => {
    const removed = {
      contacts: tx.delete(contacts).where(eq(contacts.campaignId, campaignId)).returning({ id: contacts.id }).all().length,
      imports: tx.delete(contactImports).where(eq(contactImports.campaignId, campaignId)).returning({ id: contactImports.id }).all().length,
      calls: tx.delete(calls).where(eq(calls.campaignId, campaignId)).returning({ id: calls.id }).all().length,
    }
    tx.update(campaigns).set({ purgedAt: now, updatedAt: now, status: campaign.status === 'running' || campaign.status === 'paused' ? 'completed' : campaign.status }).where(eq(campaigns.id, campaignId)).run()
    tx.insert(campaignEvents).values({ id: crypto.randomUUID(), campaignId, type: 'data.purged', payload: { reason, ...removed }, createdAt: now }).run()
    return removed
  })
  return { campaignId, purgedAt: now, ...counts }
}

// Applies the workspace retention rule: completed campaigns older than the limit lose their collected data.
export function applyRetention(db: Db, now = Date.now()) {
  const { retentionDays } = getSettings(db)
  if (!retentionDays) return []
  const cutoff = now - retentionDays * 24 * 60 * 60_000
  const due = db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(and(eq(campaigns.status, 'completed'), isNull(campaigns.purgedAt), lt(campaigns.updatedAt, cutoff)))
    .all()
  return due.map((row) => purgeCampaignData(db, row.id, 'retention', now))
}
