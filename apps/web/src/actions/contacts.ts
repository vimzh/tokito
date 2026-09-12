"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { ApiError, commitImport, deleteContact, updateContact, uploadContacts, type ImportPreview, type ImportSummary } from "@/lib/api";
import { campaignContent } from "@/data/campaign";

export type UploadState = { preview?: ImportPreview; error?: string };
export type CommitState = { summary?: ImportSummary; error?: string };
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
    return { preview: await uploadContacts(id, file) };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function commitImportAction(id: string, importId: string, _previous: CommitState, formData: FormData): Promise<CommitState> {
  await requireSession();
  const nameColumn = text(formData, "nameColumn");
  let summary: ImportSummary;
  try {
    summary = await commitImport(id, importId, {
      nameColumn: nameColumn === "" ? null : Number(nameColumn),
      phoneColumn: Number(text(formData, "phoneColumn")),
      contextColumns: formData.getAll("contextColumns").map(Number),
    });
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath(`/survey/${id}`);
  return { summary };
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
