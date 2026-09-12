"use client";

import { useState, useTransition } from "react";
import { Pause, Play, Square } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { outreachAction } from "@/actions/outreach";
import { campaignContent, campaignStatusLabels } from "@/data/campaign";
import type { OutreachStatus } from "@/lib/api";

const copy = campaignContent.outreach;
const countKeys = ["remaining", "active", "queued", "failed"] as const;

export function OutreachPanel({ campaignId, outreach }: { campaignId: string; outreach: OutreachStatus & { timezone: string } }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const run = (command: "start" | "pause" | "stop") => startTransition(async () => setError((await outreachAction(campaignId, command)).error));
  const status = outreach.campaignStatus;
  const blocking = outreach.reasons.filter((reason) => reason !== "outside_calling_hours");
  const canStart = (status === "draft" || status === "ready" || status === "paused") && blocking.length === 0;

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status === "running" ? "default" : "secondary"}>{campaignStatusLabels[status]}</Badge>
          <span className="text-sm text-muted-foreground">{copy.localTime(outreach.localTime, outreach.timezone)} {outreach.withinHours ? copy.withinHours : copy.outsideHours}.</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {(status === "draft" || status === "ready" || status === "paused") && (
            <AlertDialog>
              <AlertDialogTrigger asChild><Button disabled={pending || !canStart}><Play aria-hidden="true" />{status === "paused" ? copy.resume : copy.start}</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>{copy.startTitle}</AlertDialogTitle><AlertDialogDescription>{copy.startDescription(outreach.counts.remaining)}</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>{copy.cancel}</AlertDialogCancel><AlertDialogAction onClick={() => run("start")}>{copy.startConfirm}</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {status === "running" && <Button variant="outline" disabled={pending} onClick={() => run("pause")}><Pause aria-hidden="true" />{copy.pause}</Button>}
          {(status === "running" || status === "paused") && (
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="outline" disabled={pending}><Square aria-hidden="true" />{copy.stop}</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>{copy.stopTitle}</AlertDialogTitle><AlertDialogDescription>{copy.stopDescription}</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>{copy.cancel}</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => run("stop")}>{copy.stopConfirm}</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{copy.description}</p>
      {blocking.length > 0 && status !== "running" && status !== "completed" && (
        <p className="text-sm text-destructive">{copy.blocked} {blocking.map((reason) => copy.reasons[reason]).join("; ")}.</p>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {countKeys.map((key) => (
          <div key={key} className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">{copy.counts[key]}</dt><dd className="mt-1 text-xl tabular-nums">{outreach.counts[key]}</dd></div>
        ))}
      </dl>
      <p className="text-sm text-muted-foreground">{copy.budget(outreach.counts.callsMade, outreach.counts.budget)}</p>
    </div>
  );
}
