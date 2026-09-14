import { beforeEach, describe, expect, test } from 'bun:test'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { createDb, type Db } from '../db'
import { createCampaign } from './campaigns'
import { commitImport, createImport, listContacts, updateContact } from './contacts'
import { addOptOut } from './opt-outs'
import { parseSpreadsheet } from './spreadsheet'

let db: Db
let campaignId: string

const csv = [
  'name,phone',
  'Asha,9876543210',
  'Ravi,+91 98765 43211',
  'Blank,',
  'Bad,12345',
  'Asha again,09876543210',
  'Meera,+44 7911 123456',
].join('\n')
const bytes = () => new TextEncoder().encode(csv)

beforeEach(() => {
  db = createDb(':memory:')
  migrate(db, { migrationsFolder: './drizzle' })
  campaignId = createCampaign(db, { name: 'Menu', goal: 'Feedback', questionSource: 'ai', conversationMode: 'dynamic' }).id
})

describe('spreadsheet parsing', () => {
  test('reads the fixed name and phone columns', () => {
    const parsed = parseSpreadsheet(bytes())
    expect(parsed.headers).toEqual(['name', 'phone'])
    expect(parsed.rows).toHaveLength(6)
  })

  test('rejects files without headings', () => {
    expect(() => parseSpreadsheet(new TextEncoder().encode(',,\n'))).toThrow('column headings')
  })

  test('rejects swapped, renamed, or extra columns', () => {
    expect(() => createImport(db, campaignId, 'contacts.csv', new TextEncoder().encode('phone,name\n9876543210,Asha'))).toThrow('name, phone')
    expect(() => createImport(db, campaignId, 'contacts.csv', new TextEncoder().encode('name,mobile\nAsha,9876543210'))).toThrow('name, phone')
    expect(() => createImport(db, campaignId, 'contacts.csv', new TextEncoder().encode('name,phone,team\nAsha,9876543210,Core'))).toThrow('name, phone')
  })
})

describe('imports', () => {
  test('classifies every row and keeps problems visible', () => {
    const preview = createImport(db, campaignId, 'contacts.csv', bytes())
    expect(preview.preview).toHaveLength(5)
    const summary = commitImport(db, campaignId, preview.id)
    expect(summary.counts).toEqual({ ready: 3, invalid: 2, duplicate: 1, opted_out: 0, excluded: 0 })
    const { contacts } = listContacts(db, campaignId)
    const byName = Object.fromEntries(contacts.map((c) => [c.name, c]))
    expect(byName['Asha']).toMatchObject({ phone: '+919876543210', status: 'ready', context: {} })
    expect(byName['Ravi']).toMatchObject({ phone: '+919876543211', status: 'ready' })
    expect(byName['Blank']).toMatchObject({ status: 'invalid', problem: 'missing_phone' })
    expect(byName['Bad']).toMatchObject({ status: 'invalid', problem: 'invalid_phone' })
    expect(byName['Asha again']).toMatchObject({ status: 'duplicate', problem: 'duplicate_in_file' })
    expect(byName['Meera']).toMatchObject({ phone: '+447911123456', status: 'ready' })
  })

  test('re-importing the same file creates no new ready contacts', () => {
    const first = createImport(db, campaignId, 'contacts.csv', bytes())
    commitImport(db, campaignId, first.id)
    const second = createImport(db, campaignId, 'contacts.csv', bytes())
    const summary = commitImport(db, campaignId, second.id)
    expect(summary.counts.ready).toBe(0)
    expect(summary.counts.duplicate).toBe(4)
    expect(listContacts(db, campaignId).counts.ready).toBe(3)
    expect(() => commitImport(db, campaignId, second.id)).toThrow('already been imported')
  })

  test('opted-out numbers never become ready, even through an edit', () => {
    addOptOut(db, { phone: '9876543210', reason: 'Asked to stop' })
    const preview = createImport(db, campaignId, 'contacts.csv', bytes())
    commitImport(db, campaignId, preview.id)
    const { contacts, counts } = listContacts(db, campaignId)
    expect(counts.opted_out).toBe(2)
    const bad = contacts.find((c) => c.name === 'Bad')!
    const fixed = updateContact(db, campaignId, bad.id, { phoneRaw: '98765 43210', status: 'ready' })
    expect(fixed).toMatchObject({ phone: '+919876543210', status: 'opted_out', problem: 'opted_out' })
  })

  test('fixing an invalid number makes it ready; excluding keeps it out', () => {
    const preview = createImport(db, campaignId, 'contacts.csv', bytes())
    commitImport(db, campaignId, preview.id)
    const bad = listContacts(db, campaignId).contacts.find((c) => c.name === 'Bad')!
    expect(updateContact(db, campaignId, bad.id, { phoneRaw: '98765 43299' })).toMatchObject({ phone: '+919876543299', status: 'ready', problem: null })
    expect(updateContact(db, campaignId, bad.id, { status: 'excluded' })).toMatchObject({ status: 'excluded' })
    expect(updateContact(db, campaignId, bad.id, { phoneRaw: '9876543210', status: 'ready' })).toMatchObject({ status: 'duplicate', problem: 'duplicate_existing' })
  })

  test('adding an opt-out later marks existing ready contacts', () => {
    const preview = createImport(db, campaignId, 'contacts.csv', bytes())
    commitImport(db, campaignId, preview.id)
    addOptOut(db, { phone: '+447911123456' })
    expect(listContacts(db, campaignId).contacts.find((c) => c.name === 'Meera')?.status).toBe('opted_out')
  })
})
