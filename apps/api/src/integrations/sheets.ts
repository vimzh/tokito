import type { Db } from '../db'
import { buildExportRows } from '../calls/export'
import { createImportFromRows } from '../services/contacts'
import { accessToken } from './connections'
import { getCampaignConnection, recordSync } from './campaign-connections'
import { requestJson } from './http'

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const TABS = { answers: 'Tokito answers', calls: 'Tokito calls' } as const

const headers = (token: string) => ({ Authorization: `Bearer ${token}` })

async function firstTabTitle(token: string, spreadsheetId: string) {
  const meta = await requestJson<{ sheets?: { properties?: { title?: string } }[] }>('google', `${BASE}/${spreadsheetId}?fields=sheets.properties.title`, { headers: headers(token) })
  return meta.sheets?.[0]?.properties?.title ?? 'Sheet1'
}

// Reads the first tab of the configured sheet and turns it into a pending import (mapping reviewed as usual).
export async function importContactsFromSheet(db: Db, campaignId: string) {
  const connection = getCampaignConnection(db, campaignId, 'sheets')
  if (!connection?.config.spreadsheetId) throw new Error('No Google Sheet is configured for this campaign.')
  const token = await accessToken(db, 'google')
  const spreadsheetId = connection.config.spreadsheetId
  try {
    const tab = await firstTabTitle(token, spreadsheetId)
    const data = await requestJson<{ values?: string[][] }>('google', `${BASE}/${spreadsheetId}/values/${encodeURIComponent(tab)}?majorDimension=ROWS`, { headers: headers(token) })
    const values = (data.values ?? []).map((row) => row.map((cell) => String(cell ?? '')))
    const preview = createImportFromRows(db, campaignId, `${tab} (Google Sheet)`, values)
    recordSync(db, campaignId, 'sheets', { ok: true, externalUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`, detail: { action: 'import', rows: preview.rowCount } })
    return preview
  } catch (error) {
    recordSync(db, campaignId, 'sheets', { ok: false, error: error instanceof Error ? error.message : String(error), detail: { action: 'import' } })
    throw error
  }
}

async function ensureTab(token: string, spreadsheetId: string, title: string) {
  try {
    await requestJson('google', `${BASE}/${spreadsheetId}:batchUpdate`, { method: 'POST', headers: headers(token), body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }) })
  } catch (error) {
    if (!(error instanceof Error && /already exists/i.test(error.message))) throw error
  }
}

export function buildSheetValues(db: Db, campaignId: string) {
  const answers = buildExportRows(db, campaignId, 'answers')
  const calls = buildExportRows(db, campaignId, 'calls')
  return { answers: [answers.headers, ...answers.rows], calls: [calls.headers, ...calls.rows] }
}

// Rewrites the two Tokito tabs with the current export rows.
export async function syncResultsToSheet(db: Db, campaignId: string) {
  const connection = getCampaignConnection(db, campaignId, 'sheets')
  if (!connection?.config.spreadsheetId || !connection.enabled) return null
  const spreadsheetId = connection.config.spreadsheetId
  try {
    const token = await accessToken(db, 'google')
    const values = buildSheetValues(db, campaignId)
    for (const [kind, title] of Object.entries(TABS) as [keyof typeof TABS, string][]) {
      await ensureTab(token, spreadsheetId, title)
      const range = encodeURIComponent(`${title}!A1`)
      await requestJson('google', `${BASE}/${spreadsheetId}/values/${encodeURIComponent(`${title}!A1:ZZ`)}:clear`, { method: 'POST', headers: headers(token), body: '{}' })
      await requestJson('google', `${BASE}/${spreadsheetId}/values/${range}?valueInputOption=RAW`, { method: 'PUT', headers: headers(token), body: JSON.stringify({ range: `${title}!A1`, majorDimension: 'ROWS', values: values[kind] }) })
    }
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
    recordSync(db, campaignId, 'sheets', { ok: true, externalUrl: url, detail: { action: 'sync', answers: values.answers.length - 1, calls: values.calls.length - 1 } })
    return url
  } catch (error) {
    recordSync(db, campaignId, 'sheets', { ok: false, error: error instanceof Error ? error.message : String(error), detail: { action: 'sync' } })
    throw error
  }
}
