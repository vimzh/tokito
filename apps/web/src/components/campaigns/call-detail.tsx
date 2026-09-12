import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageContent } from "@/components/ui/message";
import { AnswersTable } from "@/components/campaigns/answers-table";
import { campaignContent } from "@/data/campaign";
import { formatDateTime } from "@/lib/format";
import type { CallDetail as CallDetailData } from "@/lib/api";

const copy = campaignContent.calls;
const testCopy = campaignContent.testCall;

export function CallDetail({ campaignId, call }: { campaignId: string; call: CallDetailData }) {
  return (
    <div className="space-y-8">
      <Link href={`/survey/${campaignId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:underline"><ArrowLeft className="size-4" aria-hidden="true" />{copy.back}</Link>
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{copy.statuses[call.status]}</Badge>
          <Badge variant="outline">{testCopy.provider[call.provider]}</Badge>
          {call.callbackRequested && <Badge variant="outline">{testCopy.callback(call.callbackTime)}</Badge>}
          {call.optOut && <Badge variant="outline">{testCopy.optOut}</Badge>}
        </div>
        <h1 className="text-3xl sm:text-4xl">{call.personName || copy.noValue}</h1>
        <p className="text-sm text-muted-foreground">{formatDateTime(call.createdAt)}{call.durationSeconds !== null ? ` · ${copy.duration(call.durationSeconds)}` : ""}{call.attempt > 1 ? ` · ${campaignContent.outreach.attempts(call.attempt)}` : ""}</p>
        {call.failureCode && <p className="text-sm text-destructive">{campaignContent.outreach.failureCodes[call.failureCode] ?? call.failureCode}{call.failureMessage ? `: ${call.failureMessage}` : ""}</p>}
      </header>
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-xl">{copy.transcript}</h2>
          <div className="space-y-3 rounded-lg border bg-card p-4">
            {call.turns.map((turn) => (
              <Message key={turn.id} align={turn.speaker === "person" ? "end" : "start"}>
                <MessageContent><Bubble variant={turn.speaker === "person" ? "default" : "secondary"}><BubbleContent>{turn.text}</BubbleContent></Bubble></MessageContent>
              </Message>
            ))}
          </div>
        </section>
        <section className="space-y-4">
          <h2 className="text-xl">{testCopy.answers}</h2>
          {call.summary && <p className="text-sm"><span className="text-muted-foreground">{testCopy.summary}: </span>{call.summary}</p>}
          {call.requestsForOrganizer && <p className="text-sm"><span className="text-muted-foreground">{testCopy.requests}: </span>{call.requestsForOrganizer}</p>}
          <AnswersTable answers={call.answers} />
        </section>
      </div>
    </div>
  );
}
