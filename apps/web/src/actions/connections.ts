"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { ApiError, disconnectProvider, importFromSheet, publishToNotion, removeCampaignConnection, setCampaignConnection, syncToSheet, type CampaignConnectionKind, type ConnectionProvider, type ImportPreview } from "@/lib/api";
import { campaignContent } from "@/data/campaign";

export type ConnectionState = { error?: string; message?: string; preview?: ImportPreview };

async function requireSession() {
  if (!(await auth())?.user) throw new Error("Unauthorized");
}

function message(error: unknown) {
  if (error instanceof ApiError) return error.message;
  console.error(error);
  return campaignContent.errors.unavailable;
}

export async function disconnectAction(provider: ConnectionProvider): Promise<ConnectionState> {
  await requireSession();
  try {
    await disconnectProvider(provider);
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath("/connections");
  return {};
}

export async function saveCampaignConnectionAction(id: string, kind: CampaignConnectionKind, _previous: ConnectionState, formData: FormData): Promise<ConnectionState> {
  await requireSession();
  try {
    const url = String(formData.get("url") ?? "").trim();
    await setCampaignConnection(id, kind, kind === "calendar" ? { enabled: true } : { url });
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath(`/survey/${id}`);
  return {};
}

export async function removeCampaignConnectionAction(id: string, kind: CampaignConnectionKind): Promise<ConnectionState> {
  await requireSession();
  try {
    await removeCampaignConnection(id, kind);
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath(`/survey/${id}`);
  return {};
}

export async function runConnectionAction(id: string, command: "sheet_import" | "sheet_sync" | "notion_publish"): Promise<ConnectionState> {
  await requireSession();
  try {
    if (command === "sheet_import") {
      const preview = await importFromSheet(id);
      revalidatePath(`/survey/${id}`);
      return { preview };
    }
    if (command === "sheet_sync") {
      const result = await syncToSheet(id);
      revalidatePath(`/survey/${id}`);
      return { message: result.url ? campaignContent.connections.synced : campaignContent.connections.notConfigured };
    }
    const result = await publishToNotion(id);
    revalidatePath(`/survey/${id}`);
    return { message: campaignContent.connections.published(result.url) };
  } catch (error) {
    revalidatePath(`/survey/${id}`);
    return { error: message(error) };
  }
}
