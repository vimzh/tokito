"use client";

import { useActionState, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { uploadContactsAction, type UploadState } from "@/actions/contacts";
import { campaignContent } from "@/data/campaign";
import type { ImportSummary } from "@/lib/api";

const copy = campaignContent.contactList;

export function ContactImport({ campaignId }: { campaignId: string }) {
  const [summary, setSummary] = useState<ImportSummary>();
  const [state, formAction, pending] = useActionState(async (previous: UploadState, formData: FormData) => {
    const result = await uploadContactsAction(campaignId, previous, formData);
    if (result.summary) setSummary(result.summary);
    return result;
  }, {});

  return (
    <div className="space-y-4">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="contacts-file">{copy.file}</Label>
          <Input id="contacts-file" name="file" type="file" accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required className="w-72" />
          <p className="text-sm text-muted-foreground">{copy.format}</p>
        </div>
        <Button type="submit" disabled={pending}><Upload aria-hidden="true" />{pending ? copy.uploading : copy.upload}</Button>
        {state.error && <p role="alert" className="basis-full text-sm text-destructive">{state.error}</p>}
      </form>
      {summary && (
        <Card>
          <CardHeader className="gap-1"><h3 className="text-lg">{copy.summaryTitle}</h3><p className="text-sm text-muted-foreground">{summary.fileName}: {copy.summary(summary.total)}</p></CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader><TableRow><TableHead>{copy.table.status}</TableHead><TableHead className="text-right">#</TableHead></TableRow></TableHeader>
              <TableBody>
                {(Object.keys(summary.counts) as (keyof typeof summary.counts)[]).map((status) => (
                  <TableRow key={status}><TableCell>{copy.counts[status]}</TableCell><TableCell className="text-right tabular-nums">{summary.counts[status]}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
            <Button type="button" variant="outline" onClick={() => setSummary(undefined)}>{copy.done}</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
