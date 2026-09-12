import { desc, eq, gt } from 'drizzle-orm'
import type { Db } from '../db'
import { campaignEvents, campaigns } from '../db/schema'

export type ActivityInput = { campaignId?: string | null; type: string; payload?: Record<string, unknown> }

export function listEvents(db: Db, options: { after?: number; limit?: number } = {}) {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200)
  const rows = db
    .select({ id: campaignEvents.id, campaignId: campaignEvents.campaignId, campaignName: campaigns.name, type: campaignEvents.type, payload: campaignEvents.payload, createdAt: campaignEvents.createdAt })
    .from(campaignEvents)
    .leftJoin(campaigns, eq(campaigns.id, campaignEvents.campaignId))
    .where(options.after ? gt(campaignEvents.createdAt, options.after) : undefined)
    .orderBy(desc(campaignEvents.createdAt))
    .limit(limit)
    .all()
  return rows.reverse()
}

// Activity entries from other surfaces (Discord) so the dashboard can show who did what.
export function recordActivity(db: Db, input: ActivityInput) {
  if (!input.campaignId) throw new Error('campaignId is required for activity events')
  const row = { id: crypto.randomUUID(), campaignId: input.campaignId, type: input.type, payload: input.payload ?? null, createdAt: Date.now() }
  db.insert(campaignEvents).values(row).run()
  return row
}
