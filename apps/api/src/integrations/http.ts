// Single injectable fetch for every outbound integration call, so tests never touch the network.
export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

let current: FetchLike = fetch

export const integrationFetch: FetchLike = (input, init) => current(input, init)
export const setIntegrationFetch = (impl: FetchLike | null) => {
  current = impl ?? fetch
}

export class IntegrationError extends Error {
  constructor(readonly provider: string, message: string, readonly status?: number) {
    super(message)
    this.name = 'IntegrationError'
  }
}

export async function requestJson<T>(provider: string, url: string, init: RequestInit & { headers?: Record<string, string> } = {}): Promise<T> {
  const response = await integrationFetch(url, { ...init, headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) } })
  const text = await response.text()
  const body = text ? (JSON.parse(text) as unknown) : null
  if (!response.ok) {
    const detail = body && typeof body === 'object' ? ((body as { error?: { message?: string } | string; message?: string }).error ?? (body as { message?: string }).message) : null
    const message = typeof detail === 'string' ? detail : detail && typeof detail === 'object' && 'message' in detail ? String(detail.message) : `${provider} request failed with status ${response.status}`
    throw new IntegrationError(provider, message, response.status)
  }
  return body as T
}
