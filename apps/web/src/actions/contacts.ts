"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { ApiError, deleteContact, updateContact, uploadContacts, type ImportSummary } from "@/lib/api";
import { campaignContent } from "@/data/campaign";

export type UploadState = { summary?: ImportSummary; error?: string };
export type ContactState = { error?: string };

async function requireSession() {
  if (!(await auth())?.user) throw new Error("Unauthorized");
}

function message(error: unknown) {
  if (error instanceof ApiError) return error.message;
  console.error(error);
  return campaignContent.errors.unavailable;
}

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

export async function uploadContactsAction(id: string, _previous: UploadState, formData: FormData): Promise<UploadState> {
  await requireSession();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: campaignContent.contactList.chooseFile };
  try {
    const summary = await uploadContacts(id, file);
    revalidatePath(`/survey/${id}`);
    return { summary };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function updateContactAction(id: string, contactId: string, _previous: ContactState, formData: FormData): Promise<ContactState> {
  await requireSession();
  try {
    await updateContact(id, contactId, { name: text(formData, "name") || null, phoneRaw: text(formData, "phoneRaw"), status: "ready" });
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath(`/survey/${id}`);
  return {};
}

export async function setContactStatusAction(id: string, contactId: string, status: "ready" | "excluded"): Promise<ContactState> {
  await requireSession();
  try {
    await updateContact(id, contactId, { status });
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath(`/survey/${id}`);
  return {};
}

export async function deleteContactAction(id: string, contactId: string): Promise<ContactState> {
  await requireSession();
  try {
    await deleteContact(id, contactId);
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath(`/survey/${id}`);
  return {};
}
