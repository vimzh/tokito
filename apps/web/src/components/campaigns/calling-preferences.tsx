"use client";

import { useActionState, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { PreferencesFields } from "@/components/campaigns/preferences-fields";
import { updatePreferencesAction, type ActionState } from "@/actions/campaigns";
import { campaignContent as copy, campaignContent } from "@/data/campaign";
import type { Campaign } from "@/lib/api";

export function CallingPreferences({ campaign }: { campaign: Campaign }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await updatePreferencesAction(campaign.id, previous, formData);
    if (!result.error) setOpen(false);
    return result;
  }, {});

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><SlidersHorizontal aria-hidden="true" />{copy.editPreferences}</Button></DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{copy.preferencesTitle}</DialogTitle><DialogDescription>{copy.preferencesDescription}</DialogDescription></DialogHeader>
        <form action={formAction} className="space-y-5">
          <PreferencesFields values={campaign} idPrefix="campaign" />
          <div className="space-y-2">
            <Label htmlFor="campaign-mode">{copy.conversationMode}</Label>
            <NativeSelect id="campaign-mode" name="conversationMode" defaultValue={campaign.conversationMode} className="w-full">
              {copy.conversationModes.map((mode) => <NativeSelectOption key={mode.value} value={mode.value}>{mode.label}</NativeSelectOption>)}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="campaign-max-calls">{campaignContent.outreach.maxCalls}</Label>
            <p id="campaign-max-calls-hint" className="text-sm text-muted-foreground">{campaignContent.outreach.maxCallsHint}</p>
            <Input id="campaign-max-calls" name="maxCalls" type="number" min={1} max={100000} aria-describedby="campaign-max-calls-hint" defaultValue={campaign.maxCalls ?? ""} />
          </div>
          <div className="flex items-center gap-3">
            <Switch id="campaign-clarifications" name="clarificationsAllowed" defaultChecked={campaign.clarificationsAllowed} />
            <Label htmlFor="campaign-clarifications" className="font-normal leading-snug">{copy.clarificationsAllowed}</Label>
          </div>
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
