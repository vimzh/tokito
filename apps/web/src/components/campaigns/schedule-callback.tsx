"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { scheduleCallbackAction, type OutreachState } from "@/actions/outreach";
import { campaignContent } from "@/data/campaign";

const copy = campaignContent.outreach;

export function ScheduleCallback({ campaignId, callId, requestedTime }: { campaignId: string; callId: string; requestedTime: string | null }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(async (previous: OutreachState, formData: FormData) => {
    const result = await scheduleCallbackAction(campaignId, callId, previous, formData);
    if (!result.error) setOpen(false);
    return result;
  }, {});
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm">{copy.scheduleCallback}</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{copy.callbackTitle}</DialogTitle><DialogDescription>{copy.callbackDescription(requestedTime)}</DialogDescription></DialogHeader>
        <form action={formAction} className="space-y-5">
          <div className="space-y-2"><Label htmlFor={`callback-${callId}`}>{copy.callbackAt}</Label><Input id={`callback-${callId}`} name="at" type="datetime-local" required /></div>
          {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>{copy.cancel}</Button><Button type="submit" disabled={pending}>{pending ? copy.working : copy.callbackConfirm}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
