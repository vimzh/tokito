"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { addOptOut, ApiError, removeOptOut } from "@/lib/api";
import { campaignContent } from "@/data/campaign";

export type OptOutState = { error?: string };

function message(error: unknown) {
  if (error instanceof ApiError) return error.message;
  console.error(error);
  return campaignContent.errors.unavailable;
}

export async function addOptOutAction(_previous: OptOutState, formData: FormData): Promise<OptOutState> {
  if (!(await auth())?.user) throw new Error("Unauthorized");
  try {
    await addOptOut({ phone: String(formData.get("phone") ?? "").trim(), reason: String(formData.get("reason") ?? "").trim() || undefined });
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath("/settings");
  return {};
}

export async function removeOptOutAction(phone: string): Promise<OptOutState> {
  if (!(await auth())?.user) throw new Error("Unauthorized");
  try {
    await removeOptOut(phone);
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath("/settings");
  return {};
}
