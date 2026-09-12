import { notFound } from "next/navigation";
import { ApiError, getCampaign, getOutreach, getTaskPreview, listCalls, listContacts, type CallSummary, type Campaign, type ContactList, type OutreachStatus, type TaskPreview } from "@/lib/api";
import { SurveyDetails } from "@/components/surveys/survey-details";

async function load(id: string): Promise<[Campaign, ContactList, CallSummary[], TaskPreview, OutreachStatus]> {
  try {
    return await Promise.all([getCampaign(id), listContacts(id), listCalls(id), getTaskPreview(id), getOutreach(id)]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export default async function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [campaign, contacts, calls, preview, outreach] = await load(id);
  return <SurveyDetails campaign={campaign} contacts={contacts} calls={calls} preview={preview} outreach={outreach} />;
}
