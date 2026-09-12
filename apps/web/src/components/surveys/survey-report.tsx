"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Survey } from "@/data/surveys";
import { surveyReportContent as copy } from "@/data/survey-report";
import { createSurveyReport } from "@/lib/survey-report";

export function SurveyReport({ survey }: { survey: Survey }) {
  const html = createSurveyReport(survey);

  function downloadReport() {
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${survey.id}-report.html`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="space-y-4" aria-label={copy.title}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="text-xl">{copy.title}</h2><p className="mt-2 max-w-xl text-sm text-muted-foreground">{copy.printHint}</p></div>
        <Button variant="outline" onClick={downloadReport}><Download aria-hidden="true" />{copy.download}</Button>
      </div>
      <iframe title={`${survey.name} — ${copy.title}`} srcDoc={html} sandbox="" className="h-[75svh] min-h-96 w-full rounded-lg border bg-card" />
    </section>
  );
}
