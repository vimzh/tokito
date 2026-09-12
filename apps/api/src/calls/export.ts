import * as XLSX from 'xlsx'
import type { Db } from '../db'
import { loadCampaignData, responseCalls } from './results'

export type ExportKind = 'answers' | 'calls'
export type ExportFormat = 'csv' | 'xlsx'

const iso = (timestamp: number | null) => (timestamp === null ? '' : new Date(timestamp).toISOString())
const yesNo = (value: boolean) => (value ? 'yes' : 'no')

export function buildExportRows(db: Db, campaignId: string, kind: ExportKind): { headers: string[]; rows: (string | number)[][] } {
  const data = loadCampaignData(db, campaignId)
  const contactById = new Map(data.contacts.map((contact) => [contact.id, contact]))
  if (kind === 'calls') {
    const headers = ['person', 'phone', 'kind', 'status', 'attempt', 'started_at', 'ended_at', 'duration_seconds', 'summary', 'callback_requested', 'callback_time', 'opt_out', 'failure_code', 'failure_message', 'call_id']
    const rows = data.calls.map((call) => {
      const contact = call.contactId ? contactById.get(call.contactId) : undefined
      return [contact?.name ?? call.personName ?? '', contact?.phone ?? '', call.provider === 'simulator' ? 'text simulation' : 'phone call', call.status, call.attempt, iso(call.startedAt), iso(call.endedAt), call.durationSeconds ?? '', call.summary ?? '', yesNo(call.callbackRequested), call.callbackTime ?? '', yesNo(call.optOut), call.failureCode ?? '', call.failureMessage ?? '', call.id]
    })
    return { headers, rows }
  }
  const responses = responseCalls(data.calls, data.contacts)
  const answersByCall = new Map<string, Map<string, (typeof data.answers)[number]>>()
  for (const answer of data.answers) {
    const forCall = answersByCall.get(answer.callId) ?? new Map()
    forCall.set(answer.questionId, answer)
    answersByCall.set(answer.callId, forCall)
  }
  const headers = ['person', 'phone', 'kind', 'status', 'ended_at', 'duration_seconds', 'summary', 'callback_requested', 'callback_time', 'opt_out', 'requests_for_organizer', 'call_id']
  data.questions.forEach((question, index) => headers.push(`Q${index + 1}: ${question.text}`, `Q${index + 1} status`, `Q${index + 1} notes`))
  const rows = responses.map((call) => {
    const row: (string | number)[] = [call.person ?? '', call.phone ?? '', call.provider === 'simulator' ? 'text simulation' : 'phone call', call.status, iso(call.endedAt), call.durationSeconds ?? '', call.summary ?? '', yesNo(call.callbackRequested), call.callbackTime ?? '', yesNo(call.optOut), call.requestsForOrganizer ?? '', call.id]
    for (const question of data.questions) {
      const answer = answersByCall.get(call.id)?.get(question.id)
      row.push(answer?.status === 'answered' ? answer.value ?? '' : '', answer?.status ?? 'missing', answer?.notes ?? '')
    }
    return row
  })
  return { headers, rows }
}

export function buildExportFile(db: Db, campaignId: string, kind: ExportKind, format: ExportFormat): { body: Uint8Array<ArrayBuffer> | string; contentType: string; fileName: string } {
  const { headers, rows } = buildExportRows(db, campaignId, kind)
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const stamp = new Date().toISOString().slice(0, 10)
  if (format === 'csv') return { body: XLSX.utils.sheet_to_csv(sheet), contentType: 'text/csv; charset=utf-8', fileName: `tokito-${kind}-${stamp}.csv` }
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, kind)
  const buffer = new Uint8Array(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array)
  return { body: buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileName: `tokito-${kind}-${stamp}.xlsx` }
}
