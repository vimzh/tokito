import { notFound } from "next/navigation";
import { surveys } from "@/data/surveys";
import { SurveyDetails } from "@/components/surveys/survey-details";

export default async function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const survey = surveys.find((item) => item.id === id);
  if (!survey) notFound();
  return <SurveyDetails survey={survey} />;
}
