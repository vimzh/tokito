import * as XLSX from 'xlsx'

export const MAX_IMPORT_ROWS = 5000

export class SpreadsheetError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SpreadsheetError'
  }
}

export function requireContactColumns(headers: string[]) {
  if (headers.length !== 2 || headers[0]?.toLowerCase() !== 'name' || headers[1]?.toLowerCase() !== 'phone') {
    throw new SpreadsheetError('Use exactly two columns in this order: name, phone.')
  }
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toString()
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).trim()
}

// Reads the first sheet of an .xlsx, .xls, or .csv file into a header row and string rows.
export function parseSpreadsheet(data: ArrayBuffer | Uint8Array): { headers: string[]; rows: string[][] } {
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(data, { type: 'array', cellDates: true })
  } catch {
    throw new SpreadsheetError('The file could not be read. Upload an .xlsx, .xls, or .csv file.')
  }
  const sheetName = workbook.SheetNames[0]
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined
  if (!sheet) throw new SpreadsheetError('The file has no sheets.')
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '' })
  const [headerRow, ...body] = matrix.map((row) => row.map(cellToString))
  if (!headerRow || headerRow.every((cell) => cell === '')) throw new SpreadsheetError('The first row must contain column headings.')
  const headers = headerRow.map((cell, index) => cell || `Column ${index + 1}`)
  const rows = body.filter((row) => row.some((cell) => cell !== '')).map((row) => headers.map((_, index) => row[index] ?? ''))
  if (rows.length === 0) throw new SpreadsheetError('The file has headings but no rows.')
  if (rows.length > MAX_IMPORT_ROWS) throw new SpreadsheetError(`The file has ${rows.length} rows; the limit is ${MAX_IMPORT_ROWS}.`)
  return { headers, rows }
}
