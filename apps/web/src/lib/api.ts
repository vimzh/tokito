import { hc, type InferRequestType, type InferResponseType } from "hono/client";
import type { AppType } from "api/src/index";

const client = hc<AppType>(process.env.API_URL ?? "http://localhost:3002");
const campaignsRoute = client.api.campaigns;
const campaignRoute = campaignsRoute[":id"];
const settingsRoute = client.api.settings;

// Routes with a validator carry an extra untyped `{}` response member from the validation hook;
// Hono's status filter cannot drop it, so response types exclude empty object members here.
type NonEmpty<T> = T extends unknown ? (keyof T extends never ? never : T) : never;
type Res<T, S extends 200 | 201> = NonEmpty<InferResponseType<T, S>>;

export type CampaignSummary = Res<typeof campaignsRoute.$get, 200>[number];
export type Campaign = Res<typeof campaignRoute.$get, 200>;
export type CampaignStatus = Campaign["status"];
export type Question = Campaign["questions"][number];
export type QuestionType = Question["type"];
export type CreateCampaignInput = InferRequestType<typeof campaignsRoute.$post>["json"];
export type UpdateCampaignInput = InferRequestType<typeof campaignRoute.$patch>["json"];
export type ReplaceQuestionsInput = InferRequestType<typeof campaignRoute.questions.$put>["json"];
export type QuestionInput = ReplaceQuestionsInput["questions"][number];
export type DraftResult = Res<typeof campaignRoute.questions.draft.$post, 200>;
export type WorkspaceSettings = Res<typeof settingsRoute.$get, 200>;
export type UpdateSettingsInput = InferRequestType<typeof settingsRoute.$put>["json"];

export type ApiIssue = { path: string[]; message: string };

export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly issues: ApiIssue[] = []) {
    super(message);
    this.name = "ApiError";
  }
}

async function unwrap<T>(response: Response): Promise<T> {
  if (response.ok) return (response.status === 204 ? undefined : await response.json()) as T;
  const body = (await response.json().catch(() => null)) as { error?: { message?: string; issues?: ApiIssue[] } } | null;
  throw new ApiError(response.status, body?.error?.message ?? `Request failed with status ${response.status}`, body?.error?.issues);
}

export const listCampaigns = () => campaignsRoute.$get().then((response) => unwrap<CampaignSummary[]>(response));
export const getCampaign = (id: string) => campaignRoute.$get({ param: { id } }).then((response) => unwrap<Campaign>(response));
export const createCampaign = (json: CreateCampaignInput) => campaignsRoute.$post({ json }).then((response) => unwrap<Campaign>(response));
export const updateCampaign = (id: string, json: UpdateCampaignInput) =>
  campaignRoute.$patch({ param: { id }, json }).then((response) => unwrap<Campaign>(response));
export const replaceQuestions = (id: string, json: ReplaceQuestionsInput) =>
  campaignRoute.questions.$put({ param: { id }, json }).then((response) => unwrap<Campaign>(response));
export const draftQuestions = (id: string) => campaignRoute.questions.draft.$post({ param: { id } }).then((response) => unwrap<DraftResult>(response));
export const deleteCampaign = (id: string) => campaignRoute.$delete({ param: { id } }).then((response) => unwrap<void>(response));
export const getSettings = () => settingsRoute.$get().then((response) => unwrap<WorkspaceSettings>(response));
export const updateSettings = (json: UpdateSettingsInput) => settingsRoute.$put({ json }).then((response) => unwrap<WorkspaceSettings>(response));

// ---- Contacts and opt-outs (Phase 3) ----
const contactsRoute = campaignRoute.contacts;
const importRoute = contactsRoute.imports[":importId"];
const contactRoute = contactsRoute[":contactId"];
const optOutsRoute = client.api["opt-outs"];

export type ContactList = Res<typeof contactsRoute.$get, 200>;
export type Contact = ContactList["contacts"][number];
export type ContactStatus = Contact["status"];
export type ContactProblem = NonNullable<Contact["problem"]>;
export type ImportPreview = Res<typeof contactsRoute.imports.$post, 201>;
export type CommitImportInput = InferRequestType<typeof importRoute.commit.$post>["json"];
export type ImportSummary = Res<typeof importRoute.commit.$post, 200>;
export type UpdateContactInput = InferRequestType<typeof contactRoute.$patch>["json"];
export type OptOut = Res<typeof optOutsRoute.$get, 200>[number];

export const listContacts = (id: string) => contactsRoute.$get({ param: { id } }).then((response) => unwrap<ContactList>(response));
export const uploadContacts = (id: string, file: File) =>
  contactsRoute.imports.$post({ param: { id }, form: { file } }).then((response) => unwrap<ImportPreview>(response));
export const commitImport = (id: string, importId: string, json: CommitImportInput) =>
  importRoute.commit.$post({ param: { id, importId }, json }).then((response) => unwrap<ImportSummary>(response));
export const updateContact = (id: string, contactId: string, json: UpdateContactInput) =>
  contactRoute.$patch({ param: { id, contactId }, json }).then((response) => unwrap<Contact>(response));
export const deleteContact = (id: string, contactId: string) => contactRoute.$delete({ param: { id, contactId } }).then((response) => unwrap<void>(response));
export const listOptOuts = () => optOutsRoute.$get().then((response) => unwrap<OptOut[]>(response));
export const addOptOut = (json: { phone: string; reason?: string }) => optOutsRoute.$post({ json }).then((response) => unwrap<OptOut>(response));
export const removeOptOut = (phone: string) => optOutsRoute.remove.$post({ json: { phone } }).then((response) => unwrap<void>(response));

// ---- Calls and the text simulator (Phase 4) ----
const callsRoute = campaignRoute.calls;
const simulationsRoute = campaignRoute.simulations;

export type TaskPreview = Res<typeof campaignRoute["task-preview"]["$get"], 200>;
export type CallSummary = Res<typeof callsRoute.$get, 200>[number];
export type CallDetail = Res<typeof callsRoute[":callId"]["$get"], 200>;
export type CallTurn = CallDetail["turns"][number];
export type Answer = CallDetail["answers"][number];
export type CallStatus = CallSummary["status"];
export type AnswerStatus = Answer["status"];
export type SimulationStart = Res<typeof simulationsRoute.$post, 201>;
export type SimulationTurn = Res<typeof simulationsRoute[":callId"]["turns"]["$post"], 200>;
export type MappedResult = NonNullable<SimulationTurn["result"]>;

export const getTaskPreview = (id: string, contactId?: string) =>
  campaignRoute["task-preview"].$get({ param: { id }, query: contactId ? { contactId } : {} }).then((response) => unwrap<TaskPreview>(response));
export const listCalls = (id: string) => callsRoute.$get({ param: { id } }).then((response) => unwrap<CallSummary[]>(response));
export const getCall = (id: string, callId: string) => callsRoute[":callId"].$get({ param: { id, callId } }).then((response) => unwrap<CallDetail>(response));
export const startSimulation = (id: string, json: { contactId?: string; personName?: string }) =>
  simulationsRoute.$post({ param: { id }, json }).then((response) => unwrap<SimulationStart>(response));
export const sendSimulationTurn = (id: string, callId: string, text: string) =>
  simulationsRoute[":callId"].turns.$post({ param: { id, callId }, json: { text } }).then((response) => unwrap<SimulationTurn>(response));

// ---- Outreach through CALL-E (Phase 5) ----
const outreachRoute = campaignRoute.outreach;

export type OutreachStatus = Res<typeof outreachRoute.$get, 200>;
export type ReadinessReason = OutreachStatus["reasons"][number];
export type ContactCallSummary = NonNullable<Contact["lastCall"]>;

export const getOutreach = (id: string) => outreachRoute.$get({ param: { id } }).then((response) => unwrap<OutreachStatus>(response));
export const startOutreach = (id: string) => outreachRoute.start.$post({ param: { id } }).then((response) => unwrap<Campaign>(response));
export const pauseOutreach = (id: string) => outreachRoute.pause.$post({ param: { id } }).then((response) => unwrap<Campaign>(response));
export const stopOutreach = (id: string) => outreachRoute.stop.$post({ param: { id } }).then((response) => unwrap<Campaign>(response));
export const scheduleCallback = (id: string, callId: string, at: string) =>
  callsRoute[":callId"].callback.$post({ param: { id, callId }, json: { at } }).then((response) => unwrap<CallSummary>(response));

// ---- Results and exports (Phase 6) ----
export type CampaignResults = Res<typeof campaignRoute.results.$get, 200>;
export type QuestionResult = CampaignResults["questions"][number];
export type ExportKind = "answers" | "calls";
export type ExportFormat = "csv" | "xlsx";

export const getResults = (id: string) => campaignRoute.results.$get({ param: { id } }).then((response) => unwrap<CampaignResults>(response));
export const fetchExport = (id: string, kind: ExportKind, format: ExportFormat) => campaignRoute.export.$get({ param: { id }, query: { kind, format } });
