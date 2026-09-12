import { hc, type InferRequestType, type InferResponseType } from "hono/client";
import type { AppType } from "api/src/index";

const client = hc<AppType>(process.env.API_URL ?? "http://localhost:3002");
const campaignsRoute = client.api.campaigns;
const campaignRoute = campaignsRoute[":id"];
const settingsRoute = client.api.settings;

export type CampaignSummary = InferResponseType<typeof campaignsRoute.$get, 200>[number];
export type Campaign = InferResponseType<typeof campaignRoute.$get, 200>;
export type CampaignStatus = Campaign["status"];
export type Question = Campaign["questions"][number];
export type QuestionType = Question["type"];
export type CreateCampaignInput = InferRequestType<typeof campaignsRoute.$post>["json"];
export type UpdateCampaignInput = InferRequestType<typeof campaignRoute.$patch>["json"];
export type ReplaceQuestionsInput = InferRequestType<typeof campaignRoute.questions.$put>["json"];
export type QuestionInput = ReplaceQuestionsInput["questions"][number];
export type DraftResult = InferResponseType<typeof campaignRoute.questions.draft.$post, 200>;
export type WorkspaceSettings = InferResponseType<typeof settingsRoute.$get, 200>;
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
