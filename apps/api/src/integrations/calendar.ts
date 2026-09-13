import { eq } from 'drizzle-orm'
import type { Db } from '../db'
import { calls, campaigns, contacts } from '../db/schema'
import { accessToken } from './connections'
import { getCampaignConnection, recordSync } from './campaign-connections'
import { requestJson } from './http'

const BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

// Creates a calendar event for a scheduled callback. Returns the event id, or null when calendar is off.
export async function createCallbackEvent(db: Db, callId: string) {
  const call = db.select().from(calls).where(eq(calls.id, callId)).get()
  if (!call?.scheduledAt) return null
  const connection = getCampaignConnection(db, call.campaignId, 'calendar')
  if (!connection?.enabled) return null
  const campaign = db.select().from(campaigns).where(eq(campaigns.id, call.campaignId)).get()!
  const contact = call.contactId ? db.select().from(contacts).where(eq(contacts.id, call.contactId)).get() : undefined
  try {
    const token = await accessToken(db, 'google')
    const start = new Date(call.scheduledAt)
    const end = new Date(call.scheduledAt + campaign.maxCallMinutes * 60_000)
    const event = await requestJson<{ id: string; htmlLink?: string }>('google', BASE, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        summary: `Tokito callback: ${contact?.name ?? call.personName ?? contact?.phone ?? 'contact'} (${campaign.name})`,
        description: `Tokito will call ${contact?.phone ?? ''} at this time for "${campaign.name}". The call is placed by Tokito; this entry is for your records.`,
        start: { dateTime: start.toISOString(), timeZone: campaign.timezone },
        end: { dateTime: end.toISOString(), timeZone: campaign.timezone },
        extendedProperties: { private: { tokitoCallId: call.id } },
      }),
    })
    db.update(calls).set({ calendarEventId: event.id, updatedAt: Date.now() }).where(eq(calls.id, callId)).run()
    recordSync(db, call.campaignId, 'calendar', { ok: true, externalUrl: event.htmlLink ?? null, detail: { action: 'create', callId } })
    return event.id
  } catch (error) {
    recordSync(db, call.campaignId, 'calendar', { ok: false, error: error instanceof Error ? error.message : String(error), detail: { action: 'create', callId } })
    return null
  }
}

const outcomeLabels: Record<string, string> = { completed: 'done', declined: 'declined', callback_requested: 'asked for another time', opted_out: 'opted out', no_answer: 'no answer', busy: 'busy', failed: 'failed', canceled: 'canceled' }

// Marks the calendar entry with the outcome once the callback call has ended.
export async function updateCallbackEvent(db: Db, callId: string) {
  const call = db.select().from(calls).where(eq(calls.id, callId)).get()
  if (!call?.calendarEventId) return false
  try {
    const token = await accessToken(db, 'google')
    const current = await requestJson<{ summary?: string }>('google', `${BASE}/${call.calendarEventId}`, { headers: { Authorization: `Bearer ${token}` } })
    const base = (current.summary ?? 'Tokito callback').replace(/ \((done|declined|asked for another time|opted out|no answer|busy|failed|canceled)\)$/, '')
    await requestJson('google', `${BASE}/${call.calendarEventId}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ summary: `${base} (${outcomeLabels[call.status] ?? call.status})` }) })
    recordSync(db, call.campaignId, 'calendar', { ok: true, detail: { action: 'update', callId, status: call.status } })
    return true
  } catch (error) {
    recordSync(db, call.campaignId, 'calendar', { ok: false, error: error instanceof Error ? error.message : String(error), detail: { action: 'update', callId } })
    return false
  }
}
