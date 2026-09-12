import { notFound } from "next/navigation";
import { ApiError, getCampaign, getOutreach, getReport, getResults, getTaskPreview, listCalls, listContacts, listReportQuestions, type AskResult, type CallSummary, type Campaign, type CampaignResults, type ContactList, type OutreachStatus, type ReportResponse, type TaskPreview } from "@/lib/api";
import { SurveyDetails } from "@/components/surveys/survey-details";

async function load(id: string, reportVersion?: number): Promise<[Campaign, ContactList, CallSummary[], TaskPreview, OutreachStatus, CampaignResults, ReportResponse, AskResult[]]> {
  try {
    return await Promise.all([getCampaign(id), listContacts(id), listCalls(id), getTaskPreview(id), getOutreach(id), getResults(id), getReport(id, reportVersion), listReportQuestions(id)]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export default async function SurveyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ report?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const version = Number(query.report);
  const [campaign, contacts, calls, preview, outreach, results, report, questions] = await load(id, Number.isInteger(version) && version > 0 ? version : undefined);
  return <SurveyDetails campaign={campaign} contacts={contacts} calls={calls} preview={preview} outreach={outreach} results={results} report={report} questions={questions} />;
}
