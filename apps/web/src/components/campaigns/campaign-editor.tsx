"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateCampaignAction, type ActionState } from "@/actions/campaigns";
import { campaignContent as copy } from "@/data/campaign";
import type { Campaign } from "@/lib/api";

export function CampaignEditor({ campaign }: { campaign: Campaign }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await updateCampaignAction(campaign.id, previous, formData);
    if (!result.error) setOpen(false);
    return result;
  }, {});

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><Pencil aria-hidden="true" />{copy.edit}</Button></DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{copy.editTitle}</DialogTitle><DialogDescription>{copy.editDescription}</DialogDescription></DialogHeader>
        <form action={formAction} className="space-y-5">
          <div className="space-y-2"><Label htmlFor="edit-name">{copy.name}</Label><Input id="edit-name" name="name" defaultValue={campaign.name} maxLength={120} required /></div>
          <div className="space-y-2"><Label htmlFor="edit-goal">{copy.goalLabel}</Label><Textarea id="edit-goal" name="goal" defaultValue={campaign.goal} className="min-h-28" maxLength={2000} required /></div>
          <div className="space-y-2"><Label htmlFor="edit-topics">{copy.topicsLabel}</Label><Textarea id="edit-topics" name="additionalTopics" defaultValue={campaign.additionalTopics ?? ""} className="min-h-20" maxLength={2000} /></div>
          <div className="space-y-2"><Label htmlFor="edit-questions">{copy.questionsLabel}</Label><p id="edit-questions-hint" className="text-sm text-muted-foreground">{copy.questionsHint}</p><Textarea id="edit-questions" name="questions" aria-describedby="edit-questions-hint" defaultValue={campaign.questions.map((question) => question.text).join("\n")} className="min-h-36" maxLength={10000} /></div>
          {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>{copy.cancel}</Button>
            <Button type="submit" disabled={pending}>{pending ? copy.saving : copy.save}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
