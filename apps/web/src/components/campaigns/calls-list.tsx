import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { campaignContent } from "@/data/campaign";
import { ScheduleCallback } from "@/components/campaigns/schedule-callback";
import { formatDateTime } from "@/lib/format";
import type { CallSummary } from "@/lib/api";

const copy = campaignContent.calls;

export function CallsList({ campaignId, calls }: { campaignId: string; calls: CallSummary[] }) {
  if (calls.length === 0) return <p className="text-sm text-muted-foreground">{copy.empty}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader><TableRow>{Object.values(copy.table).map((label) => <TableHead key={label}>{label}</TableHead>)}<TableHead /></TableRow></TableHeader>
        <TableBody>
          {[...calls].reverse().map((call) => {
            const answered = call.answers.filter((answer) => answer.status === "answered").length;
            return (
              <TableRow key={call.id}>
                <TableCell className="font-medium">{call.personName || copy.noValue}</TableCell>
                <TableCell>{campaignContent.testCall.provider[call.provider]}</TableCell>
                <TableCell><Badge variant={call.status === "completed" ? "secondary" : "outline"}>{copy.statuses[call.status]}</Badge></TableCell>
                <TableCell className="max-w-80 whitespace-normal text-muted-foreground">{call.summary ?? ""}</TableCell>
                <TableCell className="tabular-nums">{copy.answered(answered, call.answers.length)}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(call.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link className="text-sm underline-offset-4 hover:underline" href={`/survey/${campaignId}/calls/${call.id}`}>{copy.open}</Link>
                    {call.status === "callback_requested" && call.contactId && <ScheduleCallback campaignId={campaignId} callId={call.id} requestedTime={call.callbackTime} />}
                    {call.status === "queued" && call.scheduledAt && <span className="text-xs text-muted-foreground">{campaignContent.outreach.callbackScheduled(formatDateTime(call.scheduledAt))}</span>}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
