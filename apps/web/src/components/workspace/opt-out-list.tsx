"use client";

import { useActionState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { addOptOutAction, removeOptOutAction } from "@/actions/opt-outs";
import { settingsContent } from "@/data/workspace-settings";
import { formatDate } from "@/lib/format";
import type { OptOut } from "@/lib/api";

const copy = settingsContent.optOuts;

export function OptOutList({ optOuts }: { optOuts: OptOut[] }) {
  const [state, formAction, pending] = useActionState(addOptOutAction, {});
  const [removing, startTransition] = useTransition();
  return (
    <Card>
      <CardHeader className="gap-2"><h2 className="text-xl">{copy.title}</h2><p className="text-sm leading-relaxed text-muted-foreground">{copy.description}</p></CardHeader>
      <CardContent className="space-y-6">
        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <div className="space-y-2"><Label htmlFor="optout-phone">{copy.phone}</Label><Input id="optout-phone" name="phone" required maxLength={50} className="w-56" /></div>
          <div className="space-y-2"><Label htmlFor="optout-reason">{copy.reason}</Label><Input id="optout-reason" name="reason" maxLength={500} className="w-72" /></div>
          <Button type="submit" disabled={pending}>{pending ? copy.adding : copy.add}</Button>
          {state.error && <p role="alert" className="basis-full text-sm text-destructive">{state.error}</p>}
        </form>
        {optOuts.length === 0 ? <p className="text-sm text-muted-foreground">{copy.empty}</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>{copy.phone}</TableHead><TableHead>{copy.reason}</TableHead><TableHead>{copy.added}</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {optOuts.map((optOut) => (
                <TableRow key={optOut.phone}>
                  <TableCell className="tabular-nums">{optOut.phone}</TableCell>
                  <TableCell className="text-muted-foreground">{optOut.reason}</TableCell>
                  <TableCell>{formatDate(optOut.createdAt)}</TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="sm" disabled={removing} onClick={() => startTransition(async () => { await removeOptOutAction(optOut.phone); })}>{copy.remove}</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
