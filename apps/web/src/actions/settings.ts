"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { ApiError, updateSettings } from "@/lib/api";
import { campaignContent } from "@/data/campaign";

export type SettingsState = { error?: string; saved?: boolean };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

export async function updateSettingsAction(_previous: SettingsState, formData: FormData): Promise<SettingsState> {
  if (!(await auth())?.user) throw new Error("Unauthorized");
  try {
    await updateSettings({
      language: text(formData, "language") === "hi" ? "hi" : "en",
      maxCallMinutes: Number(text(formData, "maxCallMinutes")),
      callingHoursStart: text(formData, "callingHoursStart"),
      callingHoursEnd: text(formData, "callingHoursEnd"),
      timezone: text(formData, "timezone"),
      maxAttempts: Number(text(formData, "maxAttempts")),
      defaultCountry: text(formData, "defaultCountry"),
    });
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    console.error(error);
    return { error: campaignContent.errors.unavailable };
  }
  revalidatePath("/settings");
  return { saved: true };
}
