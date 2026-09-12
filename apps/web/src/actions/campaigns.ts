"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ApiError, createCampaign, deleteCampaign, replaceQuestions, updateCampaign } from "@/lib/api";
import { splitLines } from "@/lib/format";
import { campaignContent } from "@/data/campaign";

export type ActionState = { error?: string };

async function requireSession() {
  if (!(await auth())?.user) throw new Error("Unauthorized");
}

function errorState(error: unknown): ActionState {
  if (error instanceof ApiError) return { error: error.message };
  console.error(error);
  return { error: campaignContent.errors.unavailable };
}

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

export async function createCampaignAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const questionSource = text(formData, "questionSource") === "manual" ? "manual" : "ai";
  const conversationMode = text(formData, "conversationMode") === "fixed" ? "fixed" : "dynamic";
  let id: string;
  try {
    const campaign = await createCampaign({
      name: text(formData, "name"),
      goal: text(formData, "goal"),
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
      additionalTopics: text(formData, "additionalTopics") || null,
    });
    await replaceQuestions(id, splitLines(text(formData, "questions")));
  } catch (error) {
    return errorState(error);
  }
  revalidatePath("/home");
  revalidatePath(`/survey/${id}`);
  return {};
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
