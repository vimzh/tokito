// The web app imports only types from the API (see src/lib/api.ts). That type graph
// reaches apps/api/src/db/index.ts, whose drizzle client is typed against "bun:sqlite".
// This minimal declaration lets `tsc` resolve it without adding Bun's globals to the web app.
declare module "bun:sqlite" {
  export class Database {
    run(sql: string): void;
    close(): void;
  }
}
