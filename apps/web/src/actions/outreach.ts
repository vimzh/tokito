"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { ApiError, pauseOutreach, scheduleCallback, startOutreach, stopOutreach } from "@/lib/api";
import { campaignContent } from "@/data/campaign";

export type OutreachState = { error?: string };

function message(error: unknown) {
  if (error instanceof ApiError) return error.message;
  console.error(error);
  return campaignContent.errors.unavailable;
}

async function requireSession() {
  if (!(await auth())?.user) throw new Error("Unauthorized");
}

export async function outreachAction(id: string, command: "start" | "pause" | "stop"): Promise<OutreachState> {
  await requireSession();
  try {
    if (command === "start") await startOutreach(id);
    if (command === "pause") await pauseOutreach(id);
    if (command === "stop") await stopOutreach(id);
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath(`/survey/${id}`);
  revalidatePath("/home");
  return {};
}

export async function scheduleCallbackAction(id: string, callId: string, _previous: OutreachState, formData: FormData): Promise<OutreachState> {
  await requireSession();
  const local = String(formData.get("at") ?? "");
  const at = new Date(local);
  if (!local || Number.isNaN(at.getTime())) return { error: campaignContent.outreach.callbackInvalid };
  try {
    await scheduleCallback(id, callId, at.toISOString());
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath(`/survey/${id}`);
  return {};
}
