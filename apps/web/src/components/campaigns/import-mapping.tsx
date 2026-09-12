"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { commitImportAction, type CommitState } from "@/actions/contacts";
import { campaignContent } from "@/data/campaign";
import type { ImportPreview, ImportSummary } from "@/lib/api";

const copy = campaignContent.contactList;

export function ImportMapping({ campaignId, preview, onCancel, onDone }: { campaignId: string; preview: ImportPreview; onCancel: () => void; onDone: (summary: ImportSummary) => void }) {
  const suggestion = preview.suggestedMapping;
  const [state, formAction, pending] = useActionState(async (previous: CommitState, formData: FormData) => {
    const result = await commitImportAction(campaignId, preview.id, previous, formData);
    if (result.summary) onDone(result.summary);
    return result;
  }, {});

  return (
    <Card>
      <CardHeader className="gap-1"><h3 className="text-lg">{copy.mappingTitle}</h3><p className="text-sm text-muted-foreground">{copy.mappingDescription(preview.fileName, preview.rowCount)}</p></CardHeader>
      <CardContent className="space-y-6">
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader><TableRow>{preview.headers.map((header, index) => <TableHead key={index}>{header}</TableHead>)}</TableRow></TableHeader>
            <TableBody>{preview.preview.map((row, rowIndex) => <TableRow key={rowIndex}>{row.map((cell, cellIndex) => <TableCell key={cellIndex} className="max-w-56 truncate">{cell}</TableCell>)}</TableRow>)}</TableBody>
          </Table>
        </div>
        <form action={formAction} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mapping-name">{copy.nameColumn}</Label>
              <NativeSelect id="mapping-name" name="nameColumn" defaultValue={suggestion.nameColumn === null ? "" : String(suggestion.nameColumn)} className="w-full">
                <NativeSelectOption value="">{copy.noNameColumn}</NativeSelectOption>
                {preview.headers.map((header, index) => <NativeSelectOption key={index} value={String(index)}>{header}</NativeSelectOption>)}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mapping-phone">{copy.phoneColumn}</Label>
              <NativeSelect id="mapping-phone" name="phoneColumn" defaultValue={suggestion.phoneColumn === null ? "" : String(suggestion.phoneColumn)} required className="w-full">
                {preview.headers.map((header, index) => <NativeSelectOption key={index} value={String(index)}>{header}</NativeSelectOption>)}
              </NativeSelect>
            </div>
          </div>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">{copy.contextColumns}</legend>
            <p className="text-sm text-muted-foreground">{copy.contextHint}</p>
            <div className="flex flex-wrap gap-4">
              {preview.headers.map((header, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Checkbox id={`mapping-context-${index}`} name="contextColumns" value={String(index)} defaultChecked={suggestion.contextColumns.includes(index)} />
                  <Label htmlFor={`mapping-context-${index}`} className="font-normal">{header}</Label>
                </div>
              ))}
            </div>
          </fieldset>
          {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={pending}>{pending ? copy.committing : copy.commit}</Button>
            <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>{copy.cancel}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
