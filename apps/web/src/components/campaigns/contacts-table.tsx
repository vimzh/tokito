"use client";

import { useState, useTransition } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ContactEditor } from "@/components/campaigns/contact-editor";
import { deleteContactAction, setContactStatusAction } from "@/actions/contacts";
import { campaignContent } from "@/data/campaign";
import type { Contact, ContactList, ContactStatus } from "@/lib/api";

const copy = campaignContent.contactList;
const statuses = Object.keys(copy.statuses) as ContactStatus[];

export function ContactsTable({ campaignId, list }: { campaignId: string; list: ContactList }) {
  const [status, setStatus] = useState<ContactStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const needle = query.trim().toLowerCase();
  const rows = list.contacts.filter((contact) => (status === "all" || contact.status === status) && (!needle || `${contact.name ?? ""} ${contact.phoneRaw} ${contact.phone ?? ""}`.toLowerCase().includes(needle)));

  const run = (action: () => Promise<{ error?: string }>) => startTransition(async () => setError((await action()).error));

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {statuses.map((key) => (
          <div key={key} className="rounded-lg border bg-card p-4"><dt className="text-sm text-muted-foreground">{copy.counts[key]}</dt><dd className="mt-2 text-2xl tabular-nums">{list.counts[key]}</dd></div>
        ))}
      </dl>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="contacts-filter">{copy.filter}</Label>
          <NativeSelect id="contacts-filter" value={status} onChange={(event) => setStatus(event.target.value as ContactStatus | "all")}>
            <NativeSelectOption value="all">{copy.all}</NativeSelectOption>
            {statuses.map((key) => <NativeSelectOption key={key} value={key}>{copy.statuses[key]}</NativeSelectOption>)}
          </NativeSelect>
        </div>
        <div className="space-y-2"><Label htmlFor="contacts-search">{copy.search}</Label><Input id="contacts-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} className="w-64" /></div>
        <p className="pb-2 text-sm text-muted-foreground">{copy.showing(rows.length, list.total)}</p>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow>{Object.values(copy.table).map((label) => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">{copy.noMatches}</TableCell></TableRow>}
            {rows.map((contact) => <ContactRow key={contact.id} campaignId={campaignId} contact={contact} pending={pending} onStatus={(next) => run(() => setContactStatusAction(campaignId, contact.id, next))} onDelete={() => run(() => deleteContactAction(campaignId, contact.id))} />)}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ContactRow({ campaignId, contact, pending, onStatus, onDelete }: { campaignId: string; contact: Contact; pending: boolean; onStatus: (status: "ready" | "excluded") => void; onDelete: () => void }) {
  const context = Object.entries(contact.context).filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`).join(" · ");
  return (
    <TableRow>
      <TableCell className="font-medium">{contact.name || <span className="text-muted-foreground">{copy.unnamed}</span>}</TableCell>
      <TableCell className="tabular-nums">{contact.phone ?? contact.phoneRaw}{contact.phone && contact.phone !== contact.phoneRaw && <span className="block text-xs text-muted-foreground">{contact.phoneRaw}</span>}</TableCell>
      <TableCell><Badge variant={contact.status === "ready" ? "secondary" : "outline"}>{copy.statuses[contact.status]}</Badge>{contact.problem && <span className="block pt-1 text-xs text-muted-foreground">{copy.problems[contact.problem]}</span>}</TableCell>
      <TableCell className="max-w-64 truncate text-sm text-muted-foreground" title={context}>{context}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          <ContactEditor campaignId={campaignId} contact={contact} />
          {contact.status === "excluded" ? <Button variant="ghost" size="sm" disabled={pending} onClick={() => onStatus("ready")}>{copy.restore}</Button> : <Button variant="ghost" size="sm" disabled={pending} onClick={() => onStatus("excluded")}>{copy.exclude}</Button>}
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="ghost" size="sm" disabled={pending}>{copy.remove}</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>{copy.removeTitle}</AlertDialogTitle><AlertDialogDescription>{copy.removeDescription}</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>{copy.cancel}</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={onDelete}>{copy.removeConfirm}</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}
