import type { Api } from './api'
import { eventMessage } from './format'

export type Poster = (channelId: string, text: string) => Promise<void>

// Polls the API's event log and posts notable events to the linked channel. Returns the new cursor.
export async function pollOnce(api: Api, post: Poster, after: number): Promise<number> {
  const events = await api.listEvents(after)
  let cursor = after
  for (const event of events) {
    cursor = Math.max(cursor, event.createdAt)
    const text = eventMessage(event)
    if (!text) continue
    const settings = await api.getSettings()
    if (!settings.discordChannelId) continue
    await post(settings.discordChannelId, text)
  }
  return cursor
}

export function startNotifier(api: Api, post: Poster, intervalSeconds: number) {
  let cursor = Date.now()
  let running = false
  const timer = setInterval(async () => {
    if (running) return
    running = true
    try {
      cursor = await pollOnce(api, post, cursor)
    } catch (error) {
      console.error('Notification poll failed:', error instanceof Error ? error.message : error)
    } finally {
      running = false
    }
  }, intervalSeconds * 1000)
  return () => clearInterval(timer)
}
