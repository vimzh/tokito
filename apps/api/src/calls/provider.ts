// CALL-E adapter. One small interface so the scheduler and webhook code never touch HTTP directly.
export type ProviderTranscriptTurn = { offset_seconds: number | null; speaker: 'bot' | 'user' | 'unknown'; text: string }
export type ProviderAttempt = {
  id: string
  phone: string
  status: 'queued' | 'dialing' | 'in_progress' | 'completed' | 'failed' | 'canceled'
  started_at: string | null
  completed_at: string | null
  summary: string | null
  transcript_turns: ProviderTranscriptTurn[]
  provider_call_id: string | null
  failure_code: string | null
  failure_message: string | null
}
export type ProviderRecipient = {
  id: string
  phones: string[]
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  structured_result: Record<string, unknown> | null
  summary: string | null
  attempts: ProviderAttempt[]
}
export type ProviderTask = {
  id: string
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'canceled'
  summary: string | null
  recipients: ProviderRecipient[]
  completed_at?: string | null
}
export type CreateCallInput = {
  task: string
  phone: string
  region: string
  locale: string
  recipientResultSchema: Record<string, unknown>
  metadata: Record<string, string>
  idempotencyKey: string
  webhookUrl?: string
}

export interface CallProvider {
  createCall(input: CreateCallInput): Promise<ProviderTask>
  getCall(providerCallId: string): Promise<ProviderTask>
}

export class ProviderError extends Error {
  constructor(readonly code: string, message: string, readonly httpStatus?: number) {
    super(message)
    this.name = 'ProviderError'
  }
}

export class ProviderNotConfiguredError extends Error {
  constructor() {
    super('Calling is not configured. Set CALLE_API_KEY for the API and restart it.')
    this.name = 'ProviderNotConfiguredError'
  }
}

export const calleConfig = {
  apiKey: process.env.CALLE_API_KEY,
  baseUrl: (process.env.CALLE_BASE_URL ?? 'https://api.heycall-e.com').replace(/\/$/, ''),
  webhookUrl: process.env.CALLE_WEBHOOK_URL,
}

export class CalleProvider implements CallProvider {
  constructor(private readonly apiKey: string, private readonly baseUrl = calleConfig.baseUrl, private readonly fetchImpl: typeof fetch = fetch) {}

  private async request<T>(path: string, init: RequestInit & { headers?: Record<string, string> } = {}): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json', ...(init.headers ?? {}) },
    })
    const body = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } } | T | null
    if (!response.ok) {
      const error = (body as { error?: { code?: string; message?: string } } | null)?.error
      throw new ProviderError(error?.code ?? `http_${response.status}`, error?.message ?? `CALL-E request failed with status ${response.status}`, response.status)
    }
    return body as T
  }

  createCall(input: CreateCallInput) {
    return this.request<ProviderTask>('/v1/calls', {
      method: 'POST',
      headers: { 'Idempotency-Key': input.idempotencyKey },
      body: JSON.stringify({
        task: input.task,
        recipients: [{ phones: [input.phone], locale: input.locale, region: input.region }],
        recipient_result_schema: input.recipientResultSchema,
        metadata: input.metadata,
        ...(input.webhookUrl ? { webhook_url: input.webhookUrl } : {}),
      }),
    })
  }

  getCall(providerCallId: string) {
    return this.request<ProviderTask>(`/v1/calls/${encodeURIComponent(providerCallId)}`)
  }
}

export const providerConfigured = () => Boolean(calleConfig.apiKey)

export function defaultProvider(): CallProvider {
  if (!calleConfig.apiKey) throw new ProviderNotConfiguredError()
  return new CalleProvider(calleConfig.apiKey)
}

export const localeFor = (language: string) => (language === 'hi' ? 'hi-IN' : 'en-US')
