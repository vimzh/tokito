"use client";

import { useState, useTransition } from "react";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { purgeCampaignAction } from "@/actions/campaigns";
import { campaignContent as copy } from "@/data/campaign";

export function PurgeCampaignButton({ id }: { id: string }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant="outline"><Eraser aria-hidden="true" />{copy.purge}</Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{copy.purgeTitle}</AlertDialogTitle><AlertDialogDescription>{copy.purgeDescription}</AlertDialogDescription></AlertDialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{copy.cancel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pending} onClick={(event) => { event.preventDefault(); startTransition(async () => setError((await purgeCampaignAction(id)).error)); }}>{pending ? copy.purging : copy.purgeConfirm}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
