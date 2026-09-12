import { desc, eq } from 'drizzle-orm'
import type { Db } from '../db'
import { optOuts } from '../db/schema'
import type { AddOptOutInput } from '../validation/contacts'
import { markOptedOut } from './contacts'
import { normalizePhone } from './phone'
import { getSettings } from './settings'

export class InvalidPhoneError extends Error {
  constructor() {
    super('That is not a valid phone number for the workspace default country.')
    this.name = 'InvalidPhoneError'
  }
}

export function listOptOuts(db: Db) {
  return db.select().from(optOuts).orderBy(desc(optOuts.createdAt)).all()
}

export function addOptOut(db: Db, input: AddOptOutInput) {
  const phone = normalizePhone(input.phone, getSettings(db).defaultCountry)
  if (!phone) throw new InvalidPhoneError()
  db.insert(optOuts).values({ phone, reason: input.reason || null, createdAt: Date.now() }).onConflictDoNothing().run()
  markOptedOut(db, phone)
  return db.select().from(optOuts).where(eq(optOuts.phone, phone)).get()!
}

export function removeOptOut(db: Db, rawPhone: string) {
  const phone = normalizePhone(rawPhone, getSettings(db).defaultCountry) ?? rawPhone
  db.delete(optOuts).where(eq(optOuts.phone, phone)).run()
}
