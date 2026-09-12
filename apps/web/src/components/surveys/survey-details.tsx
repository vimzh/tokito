import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { surveyContent as copy, type Survey } from "@/data/surveys";
import { SurveyReport } from "@/components/surveys/survey-report";

export function SurveyDetails({ survey }: { survey: Survey }) {
  return (
    <div className="space-y-8">
      <Link href="/home" className="inline-flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:underline"><ArrowLeft className="size-4" aria-hidden="true" />{copy.back}</Link>
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3"><Badge variant="secondary">{survey.status}</Badge><span className="text-sm text-muted-foreground">{survey.date}</span></div>
        <h1 className="text-3xl sm:text-4xl">{survey.name}</h1>
        <p className="text-sm text-muted-foreground">{copy.demo}</p>
      </header>
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {copy.metrics.map(({ key, label }) => <div key={key} className="rounded-lg border bg-card p-5"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-3 text-3xl tabular-nums">{survey[key]}</dd></div>)}
      </dl>
      <Tabs defaultValue="overview" className="gap-6">
        <TabsList variant="line" className="gap-4"><TabsTrigger value="overview">{copy.overview}</TabsTrigger><TabsTrigger value="responses">{copy.responses}</TabsTrigger><TabsTrigger value="report">{copy.report}</TabsTrigger></TabsList>
        <TabsContent value="overview" className="space-y-7">
          <section className="max-w-3xl space-y-3"><h2 className="text-xl">{copy.goal}</h2><p className="leading-7 text-muted-foreground">{survey.goal}</p></section>
          <section className="space-y-3"><h2 className="text-xl">{copy.questions}</h2><Card><CardContent><ol className="list-decimal space-y-4 pl-5 leading-6">{survey.questions.map((question) => <li key={question} className="pl-2">{question}</li>)}</ol></CardContent></Card></section>
        </TabsContent>
        <TabsContent value="responses" className="space-y-4">
          <p className="text-muted-foreground">{copy.responseNote}</p>
          {survey.responses.map((response) => <Card key={response.person}><CardContent className="space-y-4"><h2 className="text-lg">{response.person}</h2><dl className="space-y-3"><div><dt className="text-xs text-muted-foreground">{copy.answer}</dt><dd className="mt-1 leading-6">{response.answer}</dd></div><div><dt className="text-xs text-muted-foreground">{copy.followUp}</dt><dd className="mt-1 leading-6">{response.followUp}</dd></div></dl></CardContent></Card>)}
        </TabsContent>
        <TabsContent value="report"><SurveyReport survey={survey} /></TabsContent>
      </Tabs>
    </div>
  );
}
