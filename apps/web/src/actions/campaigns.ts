"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ApiError, createCampaign, deleteCampaign, draftQuestions, purgeCampaign, replaceQuestions, updateCampaign, type DraftResult, type ReplaceQuestionsInput } from "@/lib/api";
import { splitLines } from "@/lib/format";
import { campaignContent } from "@/data/campaign";

export type ActionState = { error?: string };
export type DraftState = { draft?: DraftResult; error?: string };

async function requireSession() {
  if (!(await auth())?.user) throw new Error("Unauthorized");
}

function errorState(error: unknown): ActionState {
  if (error instanceof ApiError) return { error: error.message };
  console.error(error);
  return { error: campaignContent.errors.unavailable };
}

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const number = (formData: FormData, key: string) => Number(text(formData, key));

function revalidateCampaign(id: string) {
  revalidatePath("/home");
  revalidatePath(`/survey/${id}`);
}

export async function createCampaignAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const questionSource = text(formData, "questionSource") === "manual" ? "manual" : "ai";
  const conversationMode = text(formData, "conversationMode") === "fixed" ? "fixed" : "dynamic";
  let id: string;
  try {
    const campaign = await createCampaign({
      name: text(formData, "name"),
      goal: text(formData, "goal"),
      context: text(formData, "context") || undefined,
      additionalTopics: text(formData, "additionalTopics") || undefined,
      questionSource,
      conversationMode,
      questions: questionSource === "manual" ? splitLines(text(formData, "questions")) : undefined,
    });
    id = campaign.id;
  } catch (error) {
    return errorState(error);
  }
  revalidatePath("/home");
  redirect(`/survey/${id}`);
}

export async function updateCampaignAction(id: string, _previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  try {
    await updateCampaign(id, {
      name: text(formData, "name"),
      goal: text(formData, "goal"),
      context: text(formData, "context") || null,
      additionalTopics: text(formData, "additionalTopics") || null,
    });
  } catch (error) {
    return errorState(error);
  }
  revalidateCampaign(id);
  return {};
}

export async function updatePreferencesAction(id: string, _previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  try {
    await updateCampaign(id, {
      language: text(formData, "language") === "hi" ? "hi" : "en",
      maxCallMinutes: number(formData, "maxCallMinutes"),
      callingHoursStart: text(formData, "callingHoursStart"),
      callingHoursEnd: text(formData, "callingHoursEnd"),
      timezone: text(formData, "timezone"),
      maxAttempts: number(formData, "maxAttempts"),
      defaultCountry: text(formData, "defaultCountry"),
      conversationMode: text(formData, "conversationMode") === "fixed" ? "fixed" : "dynamic",
      clarificationsAllowed: formData.get("clarificationsAllowed") === "on",
      maxCalls: text(formData, "maxCalls") ? number(formData, "maxCalls") : null,
    });
  } catch (error) {
    return errorState(error);
  }
  revalidateCampaign(id);
  return {};
}

function parseQuestionsPayload(formData: FormData): ReplaceQuestionsInput {
  const questions = JSON.parse(text(formData, "questions") || "[]") as unknown;
  const draft = text(formData, "draft");
  if (!Array.isArray(questions)) throw new ApiError(400, campaignContent.errors.invalidQuestions);
  return { questions: questions as ReplaceQuestionsInput["questions"], draft: draft ? (JSON.parse(draft) as ReplaceQuestionsInput["draft"]) : undefined };
}

export async function saveQuestionsAction(id: string, _previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  try {
    await replaceQuestions(id, parseQuestionsPayload(formData));
  } catch (error) {
    return errorState(error);
  }
  revalidateCampaign(id);
  return {};
}

export async function draftQuestionsAction(id: string): Promise<DraftState> {
  await requireSession();
  try {
    return { draft: await draftQuestions(id) };
  } catch (error) {
    return errorState(error);
  }
}

export async function deleteCampaignAction(id: string): Promise<ActionState> {
  await requireSession();
  try {
    await deleteCampaign(id);
  } catch (error) {
    return errorState(error);
  }
  revalidatePath("/home");
  redirect("/home");
}

export async function purgeCampaignAction(id: string): Promise<ActionState> {
  await requireSession();
  try {
    await purgeCampaign(id);
  } catch (error) {
    return errorState(error);
  }
  revalidatePath("/home");
  revalidatePath(`/survey/${id}`);
  return {};
}
