import type { Db } from '../db'

// Lets the call layer announce moments the integrations care about without importing them.
export type HookEvents = {
  'call.terminal': { db: Db; campaignId: string; callId: string }
  'callback.scheduled': { db: Db; campaignId: string; callId: string }
}

type Handler<K extends keyof HookEvents> = (payload: HookEvents[K]) => Promise<unknown> | unknown
const handlers: { [K in keyof HookEvents]: Handler<K>[] } = { 'call.terminal': [], 'callback.scheduled': [] }

export function onHook<K extends keyof HookEvents>(event: K, handler: Handler<K>) {
  handlers[event].push(handler)
  return () => {
    handlers[event] = handlers[event].filter((item) => item !== handler) as typeof handlers[K]
  }
}

// Runs every handler and never throws; each integration records its own failure.
export async function emitHook<K extends keyof HookEvents>(event: K, payload: HookEvents[K]) {
  await Promise.all(handlers[event].map(async (handler) => {
    try {
      await handler(payload)
    } catch (error) {
      console.error(`Hook ${event} failed:`, error instanceof Error ? error.message : error)
    }
  }))
}

export function resetHooks() {
  handlers['call.terminal'] = []
  handlers['callback.scheduled'] = []
}
