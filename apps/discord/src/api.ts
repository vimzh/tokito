import { hc, type InferRequestType, type InferResponseType } from 'hono/client'
import type { AppType } from 'api/src/index'

type NonEmpty<T> = T extends unknown ? (keyof T extends never ? never : T) : never
type Res<T, S extends 200 | 201> = NonEmpty<InferResponseType<T, S>>

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>
type MinimalResponse = { ok: boolean; status: number; json(): Promise<unknown> }

async function unwrap<T>(response: MinimalResponse): Promise<T> {
  if (response.ok) return (response.status === 204 ? undefined : await response.json()) as T
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
  throw new ApiError(response.status, body?.error?.message ?? `Request failed with status ${response.status}`)
}

// The same typed client the dashboard uses, so Discord and the web see identical state.
export function createApi(baseUrl: string, fetchImpl: FetchLike = fetch, token = process.env.API_TOKEN) {
  const client = hc<AppType>(baseUrl, { fetch: fetchImpl as typeof fetch, headers: (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {}) })
  const campaignsRoute = client.api.campaigns
  const campaign = campaignsRoute[':id']
  type CampaignSummary = Res<typeof campaignsRoute.$get, 200>[number]
  type Campaign = Res<typeof campaign.$get, 200>
  type CreateCampaignInput = InferRequestType<typeof campaignsRoute.$post>['json']
  type ReplaceQuestionsInput = InferRequestType<typeof campaign.questions.$put>['json']
  type DraftResult = Res<typeof campaign.questions.draft.$post, 200>
  type ContactList = Res<typeof campaign.contacts.$get, 200>
  type ImportPreview = Res<typeof campaign.contacts.imports.$post, 201>
  type ImportSummary = Res<typeof campaign.contacts.imports[':importId']['commit']['$post'], 200>
  type CommitInput = InferRequestType<typeof campaign.contacts.imports[':importId']['commit']['$post']>['json']
  type OutreachStatus = Res<typeof campaign.outreach.$get, 200>
  type CampaignResults = Res<typeof campaign.results.$get, 200>
  type ReportResponse = Res<typeof campaign.report.$get, 200>
  type Report = Res<typeof campaign.report.$post, 201>
  type AskResult = Res<typeof campaign.report.ask.$post, 201>
  type Settings = Res<typeof client.api.settings.$get, 200>
  type EventRow = Res<typeof client.api.events.$get, 200>[number]

  return {
    listCampaigns: () => campaignsRoute.$get().then((r) => unwrap<CampaignSummary[]>(r)),
    getCampaign: (id: string) => campaign.$get({ param: { id } }).then((r) => unwrap<Campaign>(r)),
    createCampaign: (json: CreateCampaignInput) => campaignsRoute.$post({ json }).then((r) => unwrap<Campaign>(r)),
    deleteCampaign: (id: string) => campaign.$delete({ param: { id } }).then((r) => unwrap<void>(r)),
    draftQuestions: (id: string) => campaign.questions.draft.$post({ param: { id } }).then((r) => unwrap<DraftResult>(r)),
    replaceQuestions: (id: string, json: ReplaceQuestionsInput) => campaign.questions.$put({ param: { id }, json }).then((r) => unwrap<Campaign>(r)),
    listContacts: (id: string) => campaign.contacts.$get({ param: { id } }).then((r) => unwrap<ContactList>(r)),
    uploadContacts: (id: string, file: File) => campaign.contacts.imports.$post({ param: { id }, form: { file } }).then((r) => unwrap<ImportPreview>(r)),
    commitImport: (id: string, importId: string, json: CommitInput) => campaign.contacts.imports[':importId'].commit.$post({ param: { id, importId }, json }).then((r) => unwrap<ImportSummary>(r)),
    getOutreach: (id: string) => campaign.outreach.$get({ param: { id } }).then((r) => unwrap<OutreachStatus>(r)),
    startOutreach: (id: string) => campaign.outreach.start.$post({ param: { id } }).then((r) => unwrap<Campaign>(r)),
    pauseOutreach: (id: string) => campaign.outreach.pause.$post({ param: { id } }).then((r) => unwrap<Campaign>(r)),
    stopOutreach: (id: string) => campaign.outreach.stop.$post({ param: { id } }).then((r) => unwrap<Campaign>(r)),
    getResults: (id: string) => campaign.results.$get({ param: { id } }).then((r) => unwrap<CampaignResults>(r)),
    getReport: (id: string) => campaign.report.$get({ param: { id }, query: {} }).then((r) => unwrap<ReportResponse>(r)),
    generateReport: (id: string) => campaign.report.$post({ param: { id } }).then((r) => unwrap<Report>(r)),
    askReport: (id: string, question: string) => campaign.report.ask.$post({ param: { id }, json: { question } }).then((r) => unwrap<AskResult>(r)),
    getSettings: () => client.api.settings.$get().then((r) => unwrap<Settings>(r)),
    updateSettings: (json: InferRequestType<typeof client.api.settings.$put>['json']) => client.api.settings.$put({ json }).then((r) => unwrap<Settings>(r)),
    listEvents: (after?: number) => client.api.events.$get({ query: after ? { after: String(after) } : {} }).then((r) => unwrap<EventRow[]>(r)),
    recordActivity: (json: { campaignId: string; type: string; payload?: Record<string, unknown> }) => client.api.events.$post({ json }).then((r) => unwrap<unknown>(r)),
  }
}

export type Api = ReturnType<typeof createApi>
export type CampaignSummary = Awaited<ReturnType<Api['listCampaigns']>>[number]
export type Campaign = Awaited<ReturnType<Api['getCampaign']>>
export type OutreachStatus = Awaited<ReturnType<Api['getOutreach']>>
export type CampaignResults = Awaited<ReturnType<Api['getResults']>>
export type ReportResponse = Awaited<ReturnType<Api['getReport']>>
export type ReportContent = NonNullable<ReportResponse['report']>['content']
export type AskResult = Awaited<ReturnType<Api['askReport']>>
export type ImportSummary = Awaited<ReturnType<Api['commitImport']>>
export type EventRow = Awaited<ReturnType<Api['listEvents']>>[number]

// Finds a campaign by id or by a case-insensitive name fragment. Throws with the candidates when ambiguous.
export async function resolveCampaign(api: Api, ref: string): Promise<CampaignSummary> {
  const wanted = ref.trim().toLowerCase()
  const all = await api.listCampaigns()
  const exact = all.find((c) => c.id === ref || c.name.toLowerCase() === wanted)
  if (exact) return exact
  const matches = all.filter((c) => c.name.toLowerCase().includes(wanted))
  if (matches.length === 1) return matches[0]!
  if (matches.length === 0) throw new ApiError(404, `No campaign matches "${ref}". Campaigns: ${all.map((c) => c.name).join(', ') || 'none'}.`)
  throw new ApiError(400, `"${ref}" matches several campaigns: ${matches.map((c) => c.name).join(', ')}. Say which one.`)
}
