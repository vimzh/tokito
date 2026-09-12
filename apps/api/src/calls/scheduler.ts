import { and, asc, eq } from 'drizzle-orm'
import type { Db } from '../db'
import { calls, campaignEvents, campaigns, contacts, providerEvents, questions, type Call, type Campaign, type CallStatus } from '../db/schema'
import { NotFoundError } from '../services/campaigns'
import { buildCallSpec } from './task-builder'
import { statusFromProvider } from './result-mapper'
import { persistCallResult, recordOptOutFromCall, type TranscriptTurn } from './persist'
import { ProviderError, localeFor, type CallProvider, type ProviderTask } from './provider'

const id = () => crypto.randomUUID()
export const schedulerConfig = { maxActivePerCampaign: 3, retryDelayMinutes: 120, pollAfterMinutes: 2 }
const ACTIVE: CallStatus[] = ['queued', 'dialing', 'in_progress']
const TERMINAL_FOR_CONTACT: CallStatus[] = ['completed', 'declined', 'opted_out', 'callback_requested']

export class OutreachError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OutreachError'
  }
}

export type ReadinessReason = 'no_questions' | 'no_ready_contacts' | 'provider_not_configured' | 'budget_reached' | 'outside_calling_hours'

function requireCampaign(db: Db, campaignId: string) {
  const campaign = db.select().from(campaigns).where(eq(campaigns.id, campaignId)).get()
  if (!campaign) throw new NotFoundError('Campaign not found')
  return campaign
}

// "HH:MM" in the campaign's time zone for the given instant.
export function localClock(timezone: string, now: number) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(now))
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00'
  return `${get('hour')}:${get('minute')}`
}

export function withinCallingHours(campaign: Pick<Campaign, 'callingHoursStart' | 'callingHoursEnd' | 'timezone'>, now: number) {
  const clock = localClock(campaign.timezone, now)
  return clock >= campaign.callingHoursStart && clock < campaign.callingHoursEnd
}

function campaignCalls(db: Db, campaignId: string) {
  return db.select().from(calls).where(and(eq(calls.campaignId, campaignId), eq(calls.provider, 'calle'))).orderBy(asc(calls.createdAt)).all()
}

export function outreachStatus(db: Db, campaignId: string, options: { now?: number; providerConfigured: boolean }) {
  const campaign = requireCampaign(db, campaignId)
  const now = options.now ?? Date.now()
  const questionCount = db.select({ id: questions.id }).from(questions).where(eq(questions.campaignId, campaignId)).all().length
  const contactRows = db.select().from(contacts).where(eq(contacts.campaignId, campaignId)).all()
  const callRows = campaignCalls(db, campaignId)
  const byContact = new Map<string, Call[]>()
  for (const call of callRows) if (call.contactId) byContact.set(call.contactId, [...(byContact.get(call.contactId) ?? []), call])
  const ready = contactRows.filter((contact) => contact.status === 'ready')
  const counts = {
    readyContacts: ready.length,
    queued: callRows.filter((call) => call.status === 'queued').length,
    active: callRows.filter((call) => call.status === 'dialing' || call.status === 'in_progress').length,
    completed: callRows.filter((call) => call.status === 'completed').length,
    declined: callRows.filter((call) => call.status === 'declined').length,
    callbacks: callRows.filter((call) => call.status === 'callback_requested').length,
    optedOut: callRows.filter((call) => call.status === 'opted_out').length,
    failed: callRows.filter((call) => ['failed', 'no_answer', 'busy'].includes(call.status)).length,
    unreachable: ready.filter((contact) => {
      const own = byContact.get(contact.id) ?? []
      return own.length >= campaign.maxAttempts && !own.some((call) => TERMINAL_FOR_CONTACT.includes(call.status) || ACTIVE.includes(call.status))
    }).length,
    remaining: ready.filter((contact) => {
      const own = byContact.get(contact.id) ?? []
      return own.length < campaign.maxAttempts && !own.some((call) => TERMINAL_FOR_CONTACT.includes(call.status))
    }).length,
    callsMade: callRows.filter((call) => call.providerCallId).length,
    budget: campaign.maxCalls,
  }
  const reasons: ReadinessReason[] = []
  if (questionCount === 0) reasons.push('no_questions')
  if (ready.length === 0) reasons.push('no_ready_contacts')
  if (!options.providerConfigured) reasons.push('provider_not_configured')
  if (campaign.maxCalls !== null && counts.callsMade >= campaign.maxCalls) reasons.push('budget_reached')
  const withinHours = withinCallingHours(campaign, now)
  if (!withinHours) reasons.push('outside_calling_hours')
  const canStart = !reasons.some((reason) => reason !== 'outside_calling_hours')
  return { campaignStatus: campaign.status, canStart, reasons, withinHours, localTime: localClock(campaign.timezone, now), counts, startedAt: campaign.outreachStartedAt, pausedAt: campaign.outreachPausedAt, stoppedAt: campaign.outreachStoppedAt }
}

function setStatus(db: Db, campaignId: string, status: Campaign['status'], patch: Partial<Campaign>, event: string) {
  const now = Date.now()
  db.transaction((tx) => {
    tx.update(campaigns).set({ status, updatedAt: now, ...patch }).where(eq(campaigns.id, campaignId)).run()
    tx.insert(campaignEvents).values({ id: id(), campaignId, type: event, payload: { status }, createdAt: now }).run()
  })
  return requireCampaign(db, campaignId)
}

export function startOutreach(db: Db, campaignId: string, providerConfigured: boolean) {
  const status = outreachStatus(db, campaignId, { providerConfigured })
  if (!['draft', 'ready', 'paused'].includes(status.campaignStatus)) throw new OutreachError('Outreach can only start from a draft or paused campaign.')
  if (!status.canStart) throw new OutreachError(`Outreach cannot start: ${status.reasons.filter((reason) => reason !== 'outside_calling_hours').join(', ')}.`)
  return setStatus(db, campaignId, 'running', { outreachStartedAt: Date.now(), outreachPausedAt: null, outreachStoppedAt: null }, 'outreach.started')
}

export function pauseOutreach(db: Db, campaignId: string) {
  if (requireCampaign(db, campaignId).status !== 'running') throw new OutreachError('Only a running campaign can be paused.')
  return setStatus(db, campaignId, 'paused', { outreachPausedAt: Date.now() }, 'outreach.paused')
}

export function stopOutreach(db: Db, campaignId: string) {
  const campaign = requireCampaign(db, campaignId)
  if (!['running', 'paused'].includes(campaign.status)) throw new OutreachError('Only a running or paused campaign can be stopped.')
  db.update(calls).set({ status: 'canceled', updatedAt: Date.now() }).where(and(eq(calls.campaignId, campaignId), eq(calls.status, 'queued'))).run()
  return setStatus(db, campaignId, 'completed', { outreachStoppedAt: Date.now() }, 'outreach.stopped')
}

export function scheduleCallback(db: Db, campaignId: string, callId: string, at: number) {
  const source = db.select().from(calls).where(and(eq(calls.id, callId), eq(calls.campaignId, campaignId))).get()
  if (!source) throw new NotFoundError('Call not found')
  if (!source.contactId) throw new OutreachError('This call is not linked to a contact.')
  if (at < Date.now() - 60_000) throw new OutreachError('Choose a time in the future.')
  const contact = db.select().from(contacts).where(eq(contacts.id, source.contactId)).get()
  if (!contact || contact.status !== 'ready') throw new OutreachError('The contact is no longer ready to call.')
  const now = Date.now()
  const attempt = campaignCalls(db, campaignId).filter((call) => call.contactId === source.contactId).length + 1
  const row = { ...blankCall(source.campaignId, contact.id, contact.name, source.task, source.resultSchema, source.questionMap, now), attempt, scheduledAt: at }
  db.transaction((tx) => {
    tx.insert(calls).values(row).run()
    tx.update(calls).set({ callbackRequested: true, updatedAt: now }).where(eq(calls.id, callId)).run()
    tx.insert(campaignEvents).values({ id: id(), campaignId, type: 'callback.scheduled', payload: { fromCallId: callId, callId: row.id, at }, createdAt: now }).run()
  })
  return db.select().from(calls).where(eq(calls.id, row.id)).get()!
}

function blankCall(campaignId: string, contactId: string, personName: string | null, task: string, resultSchema: Record<string, unknown>, questionMap: Record<string, string>, now: number) {
  return {
    id: id(),
    campaignId,
    contactId,
    personName,
    provider: 'calle' as const,
    providerCallId: null,
    providerRecipientId: null,
    providerAttemptId: null,
    idempotencyKey: null as string | null,
    scheduledAt: null as number | null,
    lastPolledAt: null,
    attempt: 1,
    status: 'queued' as const,
    task,
    resultSchema,
    questionMap,
    summary: null,
    structuredResult: null,
    requestsForOrganizer: null,
    callbackRequested: false,
    callbackTime: null,
    optOut: false,
    failureCode: null,
    failureMessage: null,
    startedAt: null,
    endedAt: null,
    durationSeconds: null,
    createdAt: now,
    updatedAt: now,
  }
}

// Contacts that may be dialed now: ready, no active or terminal call, attempts left, retry delay elapsed.
function dialableContacts(db: Db, campaign: Campaign, now: number) {
  const ready = db.select().from(contacts).where(and(eq(contacts.campaignId, campaign.id), eq(contacts.status, 'ready'))).all()
  const callRows = campaignCalls(db, campaign.id)
  const retryDelay = schedulerConfig.retryDelayMinutes * 60_000
  return ready.filter((contact) => {
    const own = callRows.filter((call) => call.contactId === contact.id)
    if (own.some((call) => ACTIVE.includes(call.status) || TERMINAL_FOR_CONTACT.includes(call.status))) return false
    if (own.length >= campaign.maxAttempts) return false
    const last = own.at(-1)
    return !last || (last.endedAt ?? last.updatedAt) + retryDelay <= now
  })
}

async function dial(db: Db, provider: CallProvider, campaign: Campaign, call: Call & { contactPhone: string }, now: number, webhookUrl?: string) {
  const idempotencyKey = call.idempotencyKey ?? `tokito-${call.id}`
  db.update(calls).set({ idempotencyKey, updatedAt: now }).where(eq(calls.id, call.id)).run()
  try {
    const task = await provider.createCall({
      task: call.task,
      phone: call.contactPhone,
      region: campaign.defaultCountry,
      locale: localeFor(campaign.language),
      recipientResultSchema: call.resultSchema,
      metadata: { tokito_call_id: call.id, tokito_campaign_id: campaign.id },
      idempotencyKey,
      webhookUrl,
    })
    db.update(calls)
      .set({ providerCallId: task.id, providerRecipientId: task.recipients[0]?.id ?? null, status: task.status === 'queued' ? 'queued' : 'dialing', startedAt: now, lastPolledAt: now, updatedAt: now })
      .where(eq(calls.id, call.id))
      .run()
    if (task.status === 'completed' || task.status === 'failed' || task.status === 'canceled') applyProviderTask(db, { ...call, providerCallId: task.id, startedAt: now }, task, 'call.provider_sync', now)
    return true
  } catch (error) {
    const code = error instanceof ProviderError ? error.code : 'provider_error'
    const message = error instanceof Error ? error.message : String(error)
    db.transaction((tx) => {
      tx.update(calls).set({ status: 'failed', failureCode: code, failureMessage: message, endedAt: now, updatedAt: now }).where(eq(calls.id, call.id)).run()
      tx.insert(campaignEvents).values({ id: id(), campaignId: campaign.id, type: 'call.create_failed', payload: { callId: call.id, code, message }, createdAt: now }).run()
    })
    return false
  }
}

// One scheduler pass over every running campaign: dial what is due, then poll active calls.
export async function tick(db: Db, provider: CallProvider, options: { now?: number; webhookUrl?: string } = {}) {
  const now = options.now ?? Date.now()
  const result = { dialed: 0, failed: 0, polled: 0 }
  const running = db.select().from(campaigns).where(eq(campaigns.status, 'running')).all()
  for (const campaign of running) {
    const rows = campaignCalls(db, campaign.id)
    let active = rows.filter((call) => ACTIVE.includes(call.status) && call.providerCallId).length
    const callsMade = rows.filter((call) => call.providerCallId).length
    let budgetLeft = campaign.maxCalls === null ? Number.POSITIVE_INFINITY : campaign.maxCalls - callsMade
    const contactPhone = (contactId: string | null) => (contactId ? db.select({ phone: contacts.phone }).from(contacts).where(eq(contacts.id, contactId)).get()?.phone ?? null : null)

    // Explicit callbacks scheduled by the organizer go at their time, even outside calling hours.
    const dueCallbacks = rows.filter((call) => call.status === 'queued' && !call.providerCallId && call.scheduledAt !== null && call.scheduledAt <= now)
    for (const call of dueCallbacks) {
      if (active >= schedulerConfig.maxActivePerCampaign || budgetLeft <= 0) break
      const phone = contactPhone(call.contactId)
      if (!phone) continue
      const ok = await dial(db, provider, campaign, { ...call, contactPhone: phone }, now, options.webhookUrl)
      ok ? (result.dialed++, active++, budgetLeft--) : result.failed++
    }

    if (withinCallingHours(campaign, now)) {
      const questionRows = db.select().from(questions).where(eq(questions.campaignId, campaign.id)).orderBy(asc(questions.position)).all()
      for (const contact of dialableContacts(db, campaign, now)) {
        if (active >= schedulerConfig.maxActivePerCampaign || budgetLeft <= 0 || questionRows.length === 0) break
        if (!contact.phone) continue
        const spec = buildCallSpec(campaign, questionRows, contact)
        const attempt = rows.filter((call) => call.contactId === contact.id).length + 1
        const row = { ...blankCall(campaign.id, contact.id, contact.name, spec.task, spec.resultSchema, spec.questionMap, now), attempt }
        db.insert(calls).values(row).run()
        const ok = await dial(db, provider, campaign, { ...row, contactPhone: contact.phone }, now, options.webhookUrl)
        ok ? (result.dialed++, active++, budgetLeft--) : result.failed++
      }
    }

    // Nothing left to dial and nothing in flight: the campaign is done.
    const after = outreachStatus(db, campaign.id, { now, providerConfigured: true })
    if (after.counts.remaining === 0 && after.counts.active === 0 && after.counts.queued === 0 && after.campaignStatus === 'running') {
      setStatus(db, campaign.id, 'completed', { outreachStoppedAt: now }, 'outreach.completed')
      continue
    }

    // Polling fallback for calls whose terminal webhook has not arrived.
    const stale = campaignCalls(db, campaign.id).filter((call) => ACTIVE.includes(call.status) && call.providerCallId && (call.lastPolledAt ?? 0) + schedulerConfig.pollAfterMinutes * 60_000 <= now)
    for (const call of stale) {
      try {
        const task = await provider.getCall(call.providerCallId!)
        db.update(calls).set({ lastPolledAt: now }).where(eq(calls.id, call.id)).run()
        applyProviderTask(db, call, task, 'call.polled', now)
        result.polled++
      } catch (error) {
        console.error(`Polling ${call.id} failed:`, error instanceof Error ? error.message : error)
      }
    }
  }
  return result
}

const speakerMap = { bot: 'assistant', user: 'person', unknown: 'unknown' } as const

// Applies a CALL-E task snapshot to a Tokito call: lifecycle status, transcript, answers, opt-out.
export function applyProviderTask(db: Db, call: Call, task: ProviderTask, eventType: string, now = Date.now()) {
  const recipient = task.recipients[0]
  const attempt = recipient?.attempts.at(-1)
  const structured = recipient?.structured_result ?? null
  const outcome = structured && typeof structured === 'object' && typeof (structured as { outcome?: unknown }).outcome === 'string' ? ((structured as { outcome: string }).outcome as Parameters<typeof statusFromProvider>[0]['outcome']) : null
  const status = statusFromProvider({ taskStatus: task.status, recipientStatus: recipient?.status, attemptStatus: attempt?.status, failureCode: attempt?.failure_code, outcome })
  const terminal = ['completed', 'failed', 'canceled'].includes(task.status)
  if (!terminal) {
    db.update(calls).set({ status, providerRecipientId: recipient?.id ?? call.providerRecipientId, providerAttemptId: attempt?.id ?? call.providerAttemptId, updatedAt: now }).where(eq(calls.id, call.id)).run()
    return status
  }
  const transcript: TranscriptTurn[] = (attempt?.transcript_turns ?? []).map((turn) => ({ speaker: speakerMap[turn.speaker] ?? 'unknown', text: turn.text, offsetSeconds: turn.offset_seconds }))
  const startedAt = attempt?.started_at ? Date.parse(attempt.started_at) : call.startedAt
  const endedAt = attempt?.completed_at ? Date.parse(attempt.completed_at) : now
  const fresh: Call = { ...call, providerRecipientId: recipient?.id ?? null, providerAttemptId: attempt?.id ?? null, startedAt, endedAt, durationSeconds: startedAt ? Math.max(0, Math.round((endedAt - startedAt) / 1000)) : null }
  db.update(calls).set({ providerRecipientId: fresh.providerRecipientId, providerAttemptId: fresh.providerAttemptId, startedAt, endedAt, durationSeconds: fresh.durationSeconds, updatedAt: now }).where(eq(calls.id, call.id)).run()
  const mapped = persistCallResult(db, fresh, {
    structured,
    transcript,
    status,
    failureCode: attempt?.failure_code ?? null,
    failureMessage: attempt?.failure_message ?? null,
    providerSummary: recipient?.summary ?? task.summary ?? null,
    eventType,
    now,
  })
  if (mapped.optOut) recordOptOutFromCall(db, call, attempt?.phone ?? contactPhoneOf(db, call.contactId))
  return status
}

function contactPhoneOf(db: Db, contactId: string | null) {
  if (!contactId) return null
  return db.select({ phone: contacts.phone }).from(contacts).where(eq(contacts.id, contactId)).get()?.phone ?? null
}

// Stores a webhook event once and applies it. Returns what happened so the route can answer honestly.
export function handleWebhookEvent(db: Db, event: { id: string; type: string; data: ProviderTask & Record<string, unknown> }, now = Date.now()) {
  const existing = db.select({ id: providerEvents.id }).from(providerEvents).where(eq(providerEvents.id, event.id)).get()
  if (existing) return { duplicate: true as const, matched: false, callId: null }
  const call = db.select().from(calls).where(and(eq(calls.provider, 'calle'), eq(calls.providerCallId, event.data.id))).get()
  db.insert(providerEvents).values({ id: event.id, provider: 'calle', type: event.type, callId: call?.id ?? null, payload: event as unknown as Record<string, unknown>, receivedAt: now }).run()
  if (!call) return { duplicate: false as const, matched: false, callId: null }
  try {
    applyProviderTask(db, call, event.data, `webhook.${event.type}`, now)
    db.update(providerEvents).set({ processedAt: now }).where(eq(providerEvents.id, event.id)).run()
  } catch (error) {
    db.update(providerEvents).set({ error: error instanceof Error ? error.message : String(error) }).where(eq(providerEvents.id, event.id)).run()
    throw error
  }
  return { duplicate: false as const, matched: true, callId: call.id }
}

export function contactCallSummary(db: Db, campaignId: string) {
  const rows = db.select().from(calls).where(eq(calls.campaignId, campaignId)).orderBy(asc(calls.createdAt)).all()
  const summary = new Map<string, { attempts: number; lastStatus: CallStatus; lastFailureCode: string | null; nextScheduledAt: number | null; latestCallId: string }>()
  for (const call of rows) {
    if (!call.contactId) continue
    const current = summary.get(call.contactId)
    summary.set(call.contactId, {
      attempts: (current?.attempts ?? 0) + (call.providerCallId ? 1 : 0),
      lastStatus: call.status,
      lastFailureCode: call.failureCode,
      nextScheduledAt: call.status === 'queued' && call.scheduledAt ? call.scheduledAt : current?.nextScheduledAt ?? null,
      latestCallId: call.id,
    })
  }
  return summary
}

