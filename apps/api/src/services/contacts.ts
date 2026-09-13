import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm'
import type { Db } from '../db'
import { campaignEvents, campaigns, contactImports, contacts, optOuts, type ContactProblem, type ContactStatus } from '../db/schema'
import type { CommitImportInput, UpdateContactInput } from '../validation/contacts'
import { NotFoundError } from './campaigns'
import { normalizePhone } from './phone'
import { MAX_IMPORT_ROWS, parseSpreadsheet, SpreadsheetError, suggestMapping } from './spreadsheet'
import { contactCallSummary } from '../calls/scheduler'

const id = () => crypto.randomUUID()
const PREVIEW_ROWS = 5

export class ImportStateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImportStateError'
  }
}

function requireCampaign(db: Db, campaignId: string) {
  const campaign = db.select().from(campaigns).where(eq(campaigns.id, campaignId)).get()
  if (!campaign) throw new NotFoundError('Campaign not found')
  return campaign
}

function importPreview(row: typeof contactImports.$inferSelect) {
  return {
    id: row.id,
    campaignId: row.campaignId,
    fileName: row.fileName,
    headers: row.headers,
    preview: row.rows.slice(0, PREVIEW_ROWS),
    rowCount: row.rows.length,
    suggestedMapping: suggestMapping(row.headers),
    mapping: row.mapping ?? null,
    committedAt: row.committedAt ?? null,
  }
}

export function createImport(db: Db, campaignId: string, fileName: string, data: ArrayBuffer | Uint8Array) {
  requireCampaign(db, campaignId)
  const { headers, rows } = parseSpreadsheet(data)
  return storeImport(db, campaignId, fileName, headers, rows)
}

// Same import flow for rows that came from somewhere other than a file, such as a Google Sheet.
export function createImportFromRows(db: Db, campaignId: string, sourceName: string, values: string[][]) {
  requireCampaign(db, campaignId)
  const [headerRow, ...body] = values.map((row) => row.map((cell) => cell.trim()))
  if (!headerRow || headerRow.every((cell) => cell === '')) throw new SpreadsheetError('The first row must contain column headings.')
  const headers = headerRow.map((cell, index) => cell || `Column ${index + 1}`)
  const rows = body.filter((row) => row.some((cell) => cell !== '')).map((row) => headers.map((_, index) => row[index] ?? ''))
  if (rows.length === 0) throw new SpreadsheetError('The sheet has headings but no rows.')
  if (rows.length > MAX_IMPORT_ROWS) throw new SpreadsheetError(`The sheet has ${rows.length} rows; the limit is ${MAX_IMPORT_ROWS}.`)
  return storeImport(db, campaignId, sourceName, headers, rows)
}

function storeImport(db: Db, campaignId: string, fileName: string, headers: string[], rows: string[][]) {
  const row = { id: id(), campaignId, fileName, headers, rows, createdAt: Date.now() }
  db.insert(contactImports).values(row).run()
  return importPreview({ ...row, mapping: null, committedAt: null })
}

export function getImport(db: Db, campaignId: string, importId: string) {
  const row = db.select().from(contactImports).where(and(eq(contactImports.id, importId), eq(contactImports.campaignId, campaignId))).get()
  if (!row) throw new NotFoundError('Import not found')
  return row
}

type Classified = { phone: string | null; status: ContactStatus; problem: ContactProblem | null }

function classify(db: Db, campaignId: string, phoneRaw: string, defaultCountry: string, seenInBatch: Set<string>, excludeContactId?: string): Classified {
  if (!phoneRaw.trim()) return { phone: null, status: 'invalid', problem: 'missing_phone' }
  const phone = normalizePhone(phoneRaw, defaultCountry)
  if (!phone) return { phone: null, status: 'invalid', problem: 'invalid_phone' }
  if (db.select({ phone: optOuts.phone }).from(optOuts).where(eq(optOuts.phone, phone)).get()) return { phone, status: 'opted_out', problem: 'opted_out' }
  if (seenInBatch.has(phone)) return { phone, status: 'duplicate', problem: 'duplicate_in_file' }
  const existing = db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.campaignId, campaignId), eq(contacts.phone, phone), ne(contacts.status, 'excluded'), ...(excludeContactId ? [ne(contacts.id, excludeContactId)] : [])))
    .get()
  if (existing) return { phone, status: 'duplicate', problem: 'duplicate_existing' }
  return { phone, status: 'ready', problem: null }
}

export function commitImport(db: Db, campaignId: string, importId: string, mapping: CommitImportInput) {
  const campaign = requireCampaign(db, campaignId)
  const row = getImport(db, campaignId, importId)
  if (row.committedAt) throw new ImportStateError('This file has already been imported.')
  const columnCount = row.headers.length
  const columns = [mapping.phoneColumn, ...(mapping.nameColumn === null ? [] : [mapping.nameColumn]), ...mapping.contextColumns]
  if (columns.some((column) => column >= columnCount)) throw new ImportStateError('The mapping refers to a column that is not in the file.')
  const now = Date.now()
  const seen = new Set<string>()
  const counts: Record<ContactStatus, number> = { ready: 0, invalid: 0, duplicate: 0, opted_out: 0, excluded: 0 }
  db.transaction((tx) => {
    const values = row.rows.map((cells) => {
      const phoneRaw = cells[mapping.phoneColumn] ?? ''
      const result = classify(tx as unknown as Db, campaignId, phoneRaw, campaign.defaultCountry, seen)
      if (result.status === 'ready' && result.phone) seen.add(result.phone)
      counts[result.status] += 1
      const context = Object.fromEntries(mapping.contextColumns.map((column) => [row.headers[column] ?? `Column ${column + 1}`, cells[column] ?? '']))
      return {
        id: id(),
        campaignId,
        importId,
        name: mapping.nameColumn === null ? null : cells[mapping.nameColumn] || null,
        phoneRaw,
        phone: result.phone,
        status: result.status,
        problem: result.problem,
        context,
        createdAt: now,
        updatedAt: now,
      }
    })
    for (let start = 0; start < values.length; start += 200) tx.insert(contacts).values(values.slice(start, start + 200)).run()
    tx.update(contactImports).set({ mapping, committedAt: now }).where(eq(contactImports.id, importId)).run()
    tx.update(campaigns).set({ updatedAt: now }).where(eq(campaigns.id, campaignId)).run()
    tx.insert(campaignEvents).values({ id: id(), campaignId, type: 'contacts.imported', payload: { importId, fileName: row.fileName, counts }, createdAt: now }).run()
  })
  return { importId, fileName: row.fileName, total: row.rows.length, counts }
}

export function listContacts(db: Db, campaignId: string) {
  requireCampaign(db, campaignId)
  const rows = db.select().from(contacts).where(eq(contacts.campaignId, campaignId)).orderBy(asc(sql`${contacts}.rowid`)).all()
  const counts: Record<ContactStatus, number> = { ready: 0, invalid: 0, duplicate: 0, opted_out: 0, excluded: 0 }
  for (const row of rows) counts[row.status] += 1
  const callSummary = contactCallSummary(db, campaignId)
  return { contacts: rows.map((row) => ({ ...row, lastCall: callSummary.get(row.id) ?? null })), counts, total: rows.length }
}

export function updateContact(db: Db, campaignId: string, contactId: string, input: UpdateContactInput) {
  const campaign = requireCampaign(db, campaignId)
  const existing = db.select().from(contacts).where(and(eq(contacts.id, contactId), eq(contacts.campaignId, campaignId))).get()
  if (!existing) throw new NotFoundError('Contact not found')
  const phoneRaw = input.phoneRaw ?? existing.phoneRaw
  const result = input.status === 'excluded' ? { phone: normalizePhone(phoneRaw, campaign.defaultCountry), status: 'excluded' as const, problem: null } : classify(db, campaignId, phoneRaw, campaign.defaultCountry, new Set(), contactId)
  db.update(contacts)
    .set({ name: input.name === undefined ? existing.name : input.name, phoneRaw, phone: result.phone, status: result.status, problem: result.problem, updatedAt: Date.now() })
    .where(eq(contacts.id, contactId))
    .run()
  return db.select().from(contacts).where(eq(contacts.id, contactId)).get()!
}

export function deleteContact(db: Db, campaignId: string, contactId: string) {
  requireCampaign(db, campaignId)
  const deleted = db.delete(contacts).where(and(eq(contacts.id, contactId), eq(contacts.campaignId, campaignId))).returning({ id: contacts.id }).get()
  if (!deleted) throw new NotFoundError('Contact not found')
}

export function markOptedOut(db: Db, phone: string) {
  db.update(contacts)
    .set({ status: 'opted_out', problem: 'opted_out', updatedAt: Date.now() })
    .where(and(eq(contacts.phone, phone), inArray(contacts.status, ['ready', 'duplicate'])))
    .run()
}
