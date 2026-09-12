import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { campaignContent, questionTypeLabels } from "@/data/campaign";
import type { CampaignResults, QuestionResult } from "@/lib/api";

const copy = campaignContent.results;
const statusKeys = ["answered", "skipped", "declined", "unknown", "not_asked", "missing"] as const;

export function AnswersOverview({ campaignId, results }: { campaignId: string; results: CampaignResults }) {
  if (results.responses.total === 0) return <p className="text-sm text-muted-foreground">{copy.empty}</p>;
  return (
    <div className="space-y-6">
      {results.questions.map((question, index) => <QuestionCard key={question.id} campaignId={campaignId} question={question} index={index} />)}
    </div>
  );
}

function QuestionCard({ campaignId, question, index }: { campaignId: string; question: QuestionResult; index: number }) {
  const quotes = question.answers.filter((answer) => answer.status === "answered" && (question.type === "open" ? answer.value : answer.notes));
  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2"><span className="text-sm text-muted-foreground">{index + 1}.</span><Badge variant="outline">{questionTypeLabels[question.type]}</Badge></div>
        <h3 className="text-lg leading-snug">{question.text}</h3>
        <p className="text-sm text-muted-foreground">{statusKeys.filter((key) => question.statusCounts[key] > 0).map((key) => `${copy.statuses[key]} ${question.statusCounts[key]}`).join(" · ")}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {question.rating && (
          <div className="space-y-2">
            <p className="text-sm">{copy.average(question.rating.average)}</p>
            <Distribution rows={(["1", "2", "3", "4", "5"] as const).map((score) => ({ label: score, count: question.rating!.distribution[score] }))} />
          </div>
        )}
        {question.choice && <Distribution rows={[...question.choice.totals.map((item) => ({ label: item.option, count: item.count })), ...(question.choice.other > 0 ? [{ label: copy.other, count: question.choice.other }] : [])]} />}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">{copy.quotes}</h4>
          {quotes.length === 0 ? <p className="text-sm text-muted-foreground">{copy.noQuotes}</p> : (
            <ul className="space-y-3">
              {quotes.map((answer) => (
                <li key={answer.answerId} className="rounded-lg border p-3 text-sm">
                  <p className="leading-6">{question.type === "open" ? answer.value : <><span className="font-medium">{answer.value}</span>{answer.notes ? ` — ${answer.notes}` : ""}</>}</p>
                  {question.type === "open" && answer.notes && <p className="mt-1 text-muted-foreground">{answer.notes}</p>}
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{answer.person || campaignContent.calls.noValue}</span>
                    {answer.provider === "simulator" && <Badge variant="outline">{copy.simulation}</Badge>}
                    <Link href={`/survey/${campaignId}/calls/${answer.callId}`} className="underline-offset-4 hover:underline">{copy.fromCall}</Link>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Distribution({ rows }: { rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <Table>
      <TableHeader><TableRow><TableHead className="w-40">{campaignContent.calls.answer}</TableHead><TableHead className="w-16 text-right">#</TableHead><TableHead /></TableRow></TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.label}>
            <TableCell>{row.label}</TableCell>
            <TableCell className="text-right tabular-nums">{row.count}</TableCell>
            <TableCell><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.round((row.count / max) * 100)}%` }} aria-hidden="true" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
