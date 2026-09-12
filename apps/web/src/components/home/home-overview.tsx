import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SurveyTable } from "@/components/home/survey-table";
import { homeContent } from "@/data/home";
import { surveys, surveyContent } from "@/data/surveys";

export function HomeOverview() {
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="text-3xl sm:text-4xl">{homeContent.title}</h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">{homeContent.description}</p>
        </div>
        <Button asChild className="h-10 px-4"><Link href="/survey/new"><Plus aria-hidden="true" />{surveyContent.create}</Link></Button>
      </header>
      <section aria-labelledby="running-title" className="space-y-4">
        <h2 id="running-title" className="text-xl">{homeContent.running}</h2>
        {surveys.filter((survey) => survey.status === "Running").map((survey) => (
          <Card key={survey.id} className="shadow-none">
            <CardHeader className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl">{survey.name}</h3>
              <Badge variant="outline">{survey.status}</Badge>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="max-w-2xl text-sm text-muted-foreground">{survey.goal}</p>
              <div className="space-y-2">
                <div className="flex justify-between gap-3 text-sm">
                  <span>{survey.completed} / {survey.targeted} {homeContent.progress}</span>
                  <span>{Math.round(survey.completed / survey.targeted * 100)}%</span>
                </div>
                <progress aria-label={homeContent.progress} max={survey.targeted} value={survey.completed} className="block h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">{homeContent.table.reached}: {survey.reached}</p>
                <Button asChild variant="outline"><Link href={`/survey/${survey.id}`}>{homeContent.view}<ArrowUpRight aria-hidden="true" /></Link></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
      <section aria-labelledby="history-title" className="space-y-4">
        <div>
          <h2 id="history-title" className="text-xl">{homeContent.history}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{homeContent.historyDescription}</p>
        </div>
        <SurveyTable surveys={surveys.filter((survey) => survey.status === "Completed")} />
      </section>
    </>
  );
}
