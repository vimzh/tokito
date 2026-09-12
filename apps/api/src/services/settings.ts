import { eq } from 'drizzle-orm'
import type { Db } from '../db'
import { workspaceSettings } from '../db/schema'
import type { UpdateSettingsInput } from '../validation/campaigns'

const SETTINGS_ID = 'default'

export function getSettings(db: Db) {
  const existing = db.select().from(workspaceSettings).where(eq(workspaceSettings.id, SETTINGS_ID)).get()
  if (existing) return existing
  db.insert(workspaceSettings).values({ id: SETTINGS_ID, updatedAt: Date.now() }).run()
  return db.select().from(workspaceSettings).where(eq(workspaceSettings.id, SETTINGS_ID)).get()!
}

export function updateSettings(db: Db, input: UpdateSettingsInput) {
  getSettings(db)
  db.update(workspaceSettings)
    .set({ ...input, updatedAt: Date.now() })
    .where(eq(workspaceSettings.id, SETTINGS_ID))
    .run()
  return getSettings(db)
}
