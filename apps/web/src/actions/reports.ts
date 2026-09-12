"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { ApiError, askReport, generateReport, type AskResult } from "@/lib/api";
import { campaignContent } from "@/data/campaign";

export type GenerateState = { error?: string };
export type AskState = { result?: AskResult; error?: string };

function message(error: unknown) {
  if (error instanceof ApiError) return error.message;
  console.error(error);
  return campaignContent.errors.unavailable;
}

export async function generateReportAction(id: string): Promise<GenerateState> {
  if (!(await auth())?.user) throw new Error("Unauthorized");
  try {
    await generateReport(id);
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath(`/survey/${id}`);
  return {};
}

export async function askReportAction(id: string, _previous: AskState, formData: FormData): Promise<AskState> {
  if (!(await auth())?.user) throw new Error("Unauthorized");
  const question = String(formData.get("question") ?? "").trim();
  if (question.length < 3) return { error: campaignContent.reportView.askInvalid };
  try {
    const result = await askReport(id, question);
    revalidatePath(`/survey/${id}`);
    return { result };
  } catch (error) {
    return { error: message(error) };
  }
}
