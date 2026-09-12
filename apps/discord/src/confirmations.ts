import type { Api } from './api'
import { config } from './config'

export type PendingKind = 'start' | 'pause' | 'stop' | 'set_questions' | 'delete'
export type Pending = {
  id: string
  kind: PendingKind
  campaignId: string
  campaignName: string
  userId: string
  username: string
  description: string
  payload?: { questions?: { text: string; type: 'open' | 'rating' | 'choice'; options: string[]; required: boolean; source: 'ai' | 'manual' }[] }
  expiresAt: number
}

// Pending state changes wait here until the requesting user confirms with a button.
export class Confirmations {
  private readonly pending = new Map<string, Pending>()

  create(input: Omit<Pending, 'id' | 'expiresAt'>, now = Date.now()): Pending {
    const pending = { ...input, id: crypto.randomUUID(), expiresAt: now + config.confirmMinutes * 60_000 }
    this.pending.set(pending.id, pending)
    return pending
  }

  get(id: string) {
    return this.pending.get(id)
  }

  // Removes and returns the action when the caller may run it; otherwise reports why not.
  take(id: string, userId: string, now = Date.now()): { ok: true; pending: Pending } | { ok: false; reason: 'unknown' | 'expired' | 'not_yours' } {
    const pending = this.pending.get(id)
    if (!pending) return { ok: false, reason: 'unknown' }
    if (pending.expiresAt < now) {
      this.pending.delete(id)
      return { ok: false, reason: 'expired' }
    }
    if (pending.userId !== userId) return { ok: false, reason: 'not_yours' }
    this.pending.delete(id)
    return { ok: true, pending }
  }

  cancel(id: string) {
    this.pending.delete(id)
  }
}

export const describeAction = (kind: PendingKind, campaignName: string) =>
  ({
    start: `Start calling people in **${campaignName}**. Each call costs CALL-E credit.`,
    pause: `Pause calling for **${campaignName}**. Calls in progress finish.`,
    stop: `Stop **${campaignName}** for good. Queued calls are canceled.`,
    set_questions: `Replace the questions of **${campaignName}**.`,
    delete: `Delete **${campaignName}** and everything in it.`,
  })[kind]

export async function executePending(api: Api, pending: Pending): Promise<string> {
  const actor = { source: 'discord', userId: pending.userId, username: pending.username }
  const done = async (message: string) => {
    await api.recordActivity({ campaignId: pending.campaignId, type: 'discord.action', payload: { action: pending.kind, actor } }).catch(() => undefined)
    return message
  }
  switch (pending.kind) {
    case 'start':
      await api.startOutreach(pending.campaignId)
      return done(`Calling started for **${pending.campaignName}**. Calls go out during calling hours.`)
    case 'pause':
      await api.pauseOutreach(pending.campaignId)
      return done(`Calling paused for **${pending.campaignName}**.`)
    case 'stop':
      await api.stopOutreach(pending.campaignId)
      return done(`**${pending.campaignName}** stopped and marked completed.`)
    case 'set_questions':
      await api.replaceQuestions(pending.campaignId, { questions: pending.payload?.questions ?? [] })
      return done(`Questions updated for **${pending.campaignName}** (${pending.payload?.questions?.length ?? 0} questions).`)
    case 'delete':
      await api.deleteCampaign(pending.campaignId)
      return done(`**${pending.campaignName}** deleted.`)
  }
}
