"use client";

import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReportQuote } from "@/components/campaigns/report-quote";
import { askReportAction, type AskState } from "@/actions/reports";
import { campaignContent } from "@/data/campaign";
import { formatDateTime } from "@/lib/format";
import type { AskResult } from "@/lib/api";

const copy = campaignContent.reportView;

export function AskReport({ campaignId, history, disabled }: { campaignId: string; history: AskResult[]; disabled: boolean }) {
  const [state, formAction, pending] = useActionState(askReportAction.bind(null, campaignId), {} as AskState);
  const shown = state.result ? [state.result, ...history.filter((item) => item.id !== state.result!.id)] : history;
  return (
    <div className="space-y-5">
      <div><h3 className="text-xl">{copy.ask}</h3><p className="mt-1 text-sm text-muted-foreground">{copy.askDescription}</p></div>
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="min-w-72 flex-1 space-y-2"><Label htmlFor="ask-report">{copy.ask}</Label><Input id="ask-report" name="question" placeholder={copy.askPlaceholder} maxLength={500} required disabled={disabled} /></div>
        <Button type="submit" disabled={disabled || pending}>{pending ? copy.asking : copy.askButton}</Button>
        {state.error && <p role="alert" className="basis-full text-sm text-destructive">{state.error}</p>}
      </form>
      {shown.length > 0 && (
        <ul className="space-y-4">
          {shown.map((item, index) => (
            <li key={item.id} className="space-y-3 rounded-xl border p-4">
              <p className="font-medium">{item.question}</p>
              <div className="flex flex-wrap items-center gap-2"><Badge variant={item.notEnoughEvidence ? "outline" : "secondary"}>{item.notEnoughEvidence ? copy.notEnough : copy.confidence[item.confidence]}</Badge><span className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</span></div>
              <p className="text-sm leading-6"><span className="text-muted-foreground">{copy.aiSummary}: </span>{item.answer}</p>
              {item.citations.length > 0 && <div className="space-y-2">{item.citations.map((quote) => <ReportQuote key={quote.answerId} campaignId={campaignId} quote={quote} />)}</div>}
              {index === 0 && shown.length > 1 && <p className="pt-2 text-xs text-muted-foreground">{copy.history}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
