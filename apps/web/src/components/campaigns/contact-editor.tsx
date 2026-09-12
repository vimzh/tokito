"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateContactAction, type ContactState } from "@/actions/contacts";
import { campaignContent } from "@/data/campaign";
import type { Contact } from "@/lib/api";

const copy = campaignContent.contactList;

export function ContactEditor({ campaignId, contact }: { campaignId: string; contact: Contact }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(async (previous: ContactState, formData: FormData) => {
    const result = await updateContactAction(campaignId, contact.id, previous, formData);
    if (!result.error) setOpen(false);
    return result;
  }, {});

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="sm">{copy.edit}</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{copy.editTitle}</DialogTitle><DialogDescription>{copy.editDescription}</DialogDescription></DialogHeader>
        <form action={formAction} className="space-y-5">
          <div className="space-y-2"><Label htmlFor={`contact-${contact.id}-name`}>{copy.name}</Label><Input id={`contact-${contact.id}-name`} name="name" defaultValue={contact.name ?? ""} maxLength={200} /></div>
          <div className="space-y-2"><Label htmlFor={`contact-${contact.id}-phone`}>{copy.phone}</Label><Input id={`contact-${contact.id}-phone`} name="phoneRaw" defaultValue={contact.phoneRaw} maxLength={50} required /></div>
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
