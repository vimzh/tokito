import { notFound } from "next/navigation";
import { ApiError, getCampaign, type Campaign } from "@/lib/api";
import { SurveyDetails } from "@/components/surveys/survey-details";

async function loadCampaign(id: string): Promise<Campaign> {
  try {
    return await getCampaign(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export default async function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SurveyDetails campaign={await loadCampaign(id)} />;
}
