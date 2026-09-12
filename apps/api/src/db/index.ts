import { drizzle } from 'drizzle-orm/bun-sqlite'
import * as schema from './schema'

export function createDb(fileName: string) {
  const db = drizzle({ connection: { source: fileName }, schema })
  db.$client.run('PRAGMA journal_mode = WAL')
  db.$client.run('PRAGMA foreign_keys = ON')
  return db
}

export type Db = ReturnType<typeof createDb>

export const db = createDb(process.env.DB_FILE_NAME ?? 'local.db')
