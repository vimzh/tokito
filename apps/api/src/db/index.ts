import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import * as schema from './schema'

export function createDb(fileName: string) {
  const client = new Database(fileName, { create: true })
  client.run('PRAGMA journal_mode = WAL')
  client.run('PRAGMA foreign_keys = ON')
  return drizzle({ client, schema })
}

export type Db = ReturnType<typeof createDb>

export const db = createDb(process.env.DB_FILE_NAME ?? 'local.db')
