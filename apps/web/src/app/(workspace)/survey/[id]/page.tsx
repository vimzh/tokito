import { notFound } from "next/navigation";
import { ApiError, getCampaign, listContacts, type Campaign, type ContactList } from "@/lib/api";
import { SurveyDetails } from "@/components/surveys/survey-details";

async function load(id: string): Promise<[Campaign, ContactList]> {
  try {
    return await Promise.all([getCampaign(id), listContacts(id)]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export default async function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [campaign, contacts] = await load(id);
  return <SurveyDetails campaign={campaign} contacts={contacts} />;
}
