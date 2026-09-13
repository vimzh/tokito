import { eq } from 'drizzle-orm'
import type { Db } from '../db'
import { connections, type ConnectionProvider } from '../db/schema'
import { googleScopes, integrationConfig, providerConfigured, redirectUri } from './config'
import { IntegrationError, requestJson } from './http'
import { decryptSecret, encryptSecret } from './crypto'

export class NotConnectedError extends Error {
  constructor(provider: ConnectionProvider) {
    super(`${provider === 'google' ? 'Google' : 'Notion'} is not connected. Connect it on the Connections page.`)
    this.name = 'NotConnectedError'
  }
}

export class OAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OAuthError'
  }
}

// OAuth state values live in memory for ten minutes; a restart simply requires starting the flow again.
const states = new Map<string, { provider: ConnectionProvider; returnTo: string; expiresAt: number }>()

export function beginOAuth(provider: ConnectionProvider, returnTo: string, now = Date.now()) {
  if (!providerConfigured(provider)) throw new OAuthError(`${provider === 'google' ? 'Google' : 'Notion'} OAuth is not configured on the API (set the client id and secret).`)
  const state = crypto.randomUUID()
  states.set(state, { provider, returnTo, expiresAt: now + 10 * 60_000 })
  const params = new URLSearchParams({ client_id: integrationConfig[provider].clientId!, redirect_uri: redirectUri(provider), response_type: 'code', state })
  if (provider === 'google') {
    params.set('scope', googleScopes.join(' '))
    params.set('access_type', 'offline')
    params.set('prompt', 'consent')
    return { state, url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` }
  }
  params.set('owner', 'user')
  return { state, url: `https://api.notion.com/v1/oauth/authorize?${params}` }
}

export function consumeState(state: string, now = Date.now()) {
  const entry = states.get(state)
  states.delete(state)
  if (!entry || entry.expiresAt < now) throw new OAuthError('The sign-in link expired. Start again from the Connections page.')
  return entry
}

type GoogleToken = { access_token: string; refresh_token?: string; expires_in: number; scope?: string }
type NotionToken = { access_token: string; workspace_name?: string; owner?: { user?: { person?: { email?: string }; name?: string } } }

export async function completeOAuth(db: Db, provider: ConnectionProvider, code: string, now = Date.now()) {
  const { clientId, clientSecret } = integrationConfig[provider]
  if (provider === 'google') {
    const token = await requestJson<GoogleToken>('google', 'https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId!, client_secret: clientSecret!, redirect_uri: redirectUri('google'), grant_type: 'authorization_code' }).toString(),
    })
    let label: string | null = null
    try {
      const info = await requestJson<{ email?: string }>('google', 'https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` } })
      label = info.email ?? null
    } catch {
      label = null
    }
    return saveConnection(db, { provider, accessToken: token.access_token, refreshToken: token.refresh_token ?? null, expiresAt: now + token.expires_in * 1000, scope: token.scope ?? googleScopes.join(' '), accountLabel: label }, now)
  }
  const token = await requestJson<NotionToken>('notion', 'https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}` },
    body: JSON.stringify({ grant_type: 'authorization_code', code, redirect_uri: redirectUri('notion') }),
  })
  return saveConnection(db, { provider, accessToken: token.access_token, refreshToken: null, expiresAt: null, scope: null, accountLabel: token.workspace_name ?? token.owner?.user?.person?.email ?? token.owner?.user?.name ?? null }, now)
}

function saveConnection(db: Db, input: { provider: ConnectionProvider; accessToken: string; refreshToken: string | null; expiresAt: number | null; scope: string | null; accountLabel: string | null }, now: number) {
  const existing = db.select().from(connections).where(eq(connections.provider, input.provider)).get()
  const row = {
    ...input,
    accessToken: encryptSecret(input.accessToken),
    refreshToken: input.refreshToken ? encryptSecret(input.refreshToken) : (existing?.refreshToken ?? null),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  db.insert(connections).values(row).onConflictDoUpdate({ target: connections.provider, set: row }).run()
  return publicConnection(row)
}

export const publicConnection = (row: typeof connections.$inferSelect) => ({ provider: row.provider, accountLabel: row.accountLabel, connectedAt: row.createdAt, updatedAt: row.updatedAt })

export function listConnections(db: Db) {
  const rows = db.select().from(connections).all()
  return (['google', 'notion'] as const).map((provider) => {
    const row = rows.find((item) => item.provider === provider)
    return { provider, configured: providerConfigured(provider), connected: Boolean(row), accountLabel: row?.accountLabel ?? null, connectedAt: row?.createdAt ?? null }
  })
}

export function disconnect(db: Db, provider: ConnectionProvider) {
  db.delete(connections).where(eq(connections.provider, provider)).run()
}

// Returns a valid access token, refreshing Google tokens shortly before they expire.
export async function accessToken(db: Db, provider: ConnectionProvider, now = Date.now()): Promise<string> {
  const row = db.select().from(connections).where(eq(connections.provider, provider)).get()
  if (!row) throw new NotConnectedError(provider)
  if (provider === 'notion' || !row.expiresAt || row.expiresAt - 60_000 > now) return decryptSecret(row.accessToken)
  if (!row.refreshToken) throw new IntegrationError('google', 'The Google connection expired and cannot be refreshed. Reconnect it on the Connections page.', 401)
  const { clientId, clientSecret } = integrationConfig.google
  const token = await requestJson<GoogleToken>('google', 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token: decryptSecret(row.refreshToken), client_id: clientId ?? '', client_secret: clientSecret ?? '', grant_type: 'refresh_token' }).toString(),
  })
  db.update(connections).set({ accessToken: encryptSecret(token.access_token), expiresAt: now + token.expires_in * 1000, updatedAt: now }).where(eq(connections.provider, 'google')).run()
  return token.access_token
}
