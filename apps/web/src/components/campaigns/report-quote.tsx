import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { campaignContent } from "@/data/campaign";
import type { ReportQuote as Quote } from "@/lib/api";

const copy = campaignContent.reportView;

export function ReportQuote({ campaignId, quote }: { campaignId: string; quote: Quote }) {
  const text = quote.value ? `“${quote.value}”` : `[${campaignContent.calls.answerStatuses[quote.status]}]`;
  return (
    <blockquote className="rounded-lg border p-3 text-sm">
      <p className="leading-6">{text}{quote.notes ? <span className="text-muted-foreground"> — {quote.notes}</span> : null}</p>
      <footer className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{quote.person || campaignContent.calls.noValue}</span>
        <span>· {quote.questionText}</span>
        {quote.simulated && <Badge variant="outline">{copy.simulation}</Badge>}
        <Link href={`/survey/${campaignId}/calls/${quote.callId}`} className="underline-offset-4 hover:underline">{copy.openCall}</Link>
      </footer>
    </blockquote>
  );
}
