import { onHook } from './hooks'
import { syncResultsToSheet } from './sheets'
import { createCallbackEvent, updateCallbackEvent } from './calendar'

// Wires the integrations to the call layer. Called once at startup.
export function registerIntegrations() {
  onHook('call.terminal', ({ db, campaignId }) => syncResultsToSheet(db, campaignId).catch(() => null))
  onHook('call.terminal', ({ db, callId }) => updateCallbackEvent(db, callId))
  onHook('callback.scheduled', ({ db, callId }) => createCallbackEvent(db, callId))
}
