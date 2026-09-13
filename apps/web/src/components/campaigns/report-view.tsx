import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ReportQuote } from "@/components/campaigns/report-quote";
import { campaignContent } from "@/data/campaign";
import { formatDateTime } from "@/lib/format";
import type { Report, ReportResponse } from "@/lib/api";

const copy = campaignContent.reportView;

export function ReportView({ campaignId, report, versions }: { campaignId: string; report: Report; versions: ReportResponse["versions"] }) {
  const content = report.content;
  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">{copy.generatedBy(report.version, report.model, formatDateTime(report.createdAt))}{report.externalUrl ? <> · <a href={report.externalUrl} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">{campaignContent.connections.kinds.notion.title}</a></> : null}</p>
      <section className="space-y-3">
        <Badge variant="outline">{copy.aiSummary}</Badge>
        <p className="max-w-3xl text-lg leading-7">{content.headline}</p>
        <p className="text-sm text-muted-foreground">{copy.representativeness(content.participation.reached, content.responses.total, content.participation.people)}{content.responses.simulated > 0 ? ` ${copy.simulationsNote(content.responses.simulated)}` : ""}</p>
        {content.droppedCitations > 0 && <p className="text-sm text-muted-foreground">{copy.dropped(content.droppedCitations)}</p>}
      </section>
      <section className="space-y-4">
        <h3 className="text-xl">{copy.themes}</h3>
        {content.themes.length === 0 ? <p className="text-sm text-muted-foreground">{copy.none}</p> : content.themes.map((theme, index) => (
          <Card key={index}>
            <CardHeader className="gap-2">
              <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{copy.kinds[theme.kind]}</Badge><span className="text-sm text-muted-foreground">{copy.people(theme.peopleCount)} · {copy.evidence(theme.quotes.length)}</span></div>
              <h4 className="text-lg">{theme.title}</h4>
              <p className="text-sm text-muted-foreground"><span className="font-medium">{copy.aiSummary}: </span>{theme.description}</p>
            </CardHeader>
            <CardContent className="space-y-2">{theme.quotes.map((quote) => <ReportQuote key={quote.answerId} campaignId={campaignId} quote={quote} />)}</CardContent>
          </Card>
        ))}
      </section>
      <section className="space-y-4">
        <h3 className="text-xl">{copy.disagreements}</h3>
        {content.disagreements.length === 0 ? <p className="text-sm text-muted-foreground">{copy.none}</p> : content.disagreements.map((item, index) => (
          <Card key={index}>
            <CardHeader className="gap-2"><h4 className="text-lg">{item.topic}</h4><p className="text-sm text-muted-foreground"><span className="font-medium">{copy.aiSummary}: </span>{item.description}</p></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {item.sides.map((side, sideIndex) => (
                <div key={sideIndex} className="space-y-2">
                  <p className="text-sm font-medium">{side.position} <span className="font-normal text-muted-foreground">· {copy.people(side.peopleCount)}</span></p>
                  {side.quotes.map((quote) => <ReportQuote key={quote.answerId} campaignId={campaignId} quote={quote} />)}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="space-y-4">
        <h3 className="text-xl">{copy.requests}</h3>
        {content.requests.length === 0 ? <p className="text-sm text-muted-foreground">{copy.none}</p> : content.requests.map((item, index) => (
          <div key={index} className="space-y-2"><p className="text-sm"><span className="font-medium">{copy.aiSummary}: </span>{item.description}</p>{item.quotes.map((quote) => <ReportQuote key={quote.answerId} campaignId={campaignId} quote={quote} />)}</div>
        ))}
      </section>
      <section className="space-y-3">
        <div><h3 className="text-xl">{copy.gaps}</h3><p className="mt-1 text-sm text-muted-foreground">{copy.gapsDescription}</p></div>
        <p className="text-sm">{copy.outreachGaps(content.participation.unreachable, content.participation.callbacks, content.participation.declined)}</p>
        {content.gaps.length === 0 ? <p className="text-sm text-muted-foreground">{copy.none}</p> : (
          <ul className="space-y-2 text-sm">
            {content.gaps.map((gap) => (
              <li key={gap.questionId} className="rounded-lg border p-3">
                <p>{gap.questionText}</p>
                <p className="mt-1 text-muted-foreground">{copy.gapLine((["skipped", "declined", "unknown", "notAsked", "missing"] as const).filter((key) => gap[key] > 0).map((key) => `${gap[key]} ${copy.gapLabels[key]}`))}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-4">
        <div><h3 className="text-xl">{copy.nextSteps}</h3><p className="mt-1 text-sm text-muted-foreground">{copy.nextStepsDescription}</p></div>
        {content.nextSteps.length === 0 ? <p className="text-sm text-muted-foreground">{copy.none}</p> : content.nextSteps.map((step, index) => (
          <Card key={index}>
            <CardHeader className="gap-2"><Badge variant="outline" className="w-fit">{copy.aiSuggestion}</Badge><p className="leading-6">{step.suggestion}</p></CardHeader>
            <CardContent className="space-y-2">{step.quotes.map((quote) => <ReportQuote key={quote.answerId} campaignId={campaignId} quote={quote} />)}</CardContent>
          </Card>
        ))}
      </section>
      {versions.length > 1 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">{copy.versions}</h3>
          <ul className="flex flex-wrap gap-3 text-sm">
            {versions.filter((item) => item.version !== report.version).map((item) => (
              <li key={item.version}><Link href={`/survey/${campaignId}?report=${item.version}`} className="underline-offset-4 hover:underline">{copy.generatedBy(item.version, item.model, formatDateTime(item.createdAt))}</Link></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
