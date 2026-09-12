"use client";

import { useActionState, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveQuestionsAction } from "@/actions/campaigns";
import { campaignContent, questionTypeLabels } from "@/data/campaign";
import { splitLines } from "@/lib/format";
import type { Question, QuestionInput, QuestionType } from "@/lib/api";

const copy = campaignContent.editor;

type Row = { key: string; text: string; type: QuestionType; options: string; required: boolean; source: "ai" | "manual" };

const toRows = (questions: Question[]): Row[] =>
  questions.map((question) => ({ key: question.id, text: question.text, type: question.type, options: (question.options ?? []).join("\n"), required: question.required, source: question.source }));

const toPayload = (rows: Row[]): QuestionInput[] =>
  rows.map((row) => ({ text: row.text.trim(), type: row.type, options: row.type === "choice" ? splitLines(row.options) : [], required: row.required, source: row.source }));

export function QuestionEditor({ campaignId, questions }: { campaignId: string; questions: Question[] }) {
  const [rows, setRows] = useState<Row[]>(() => toRows(questions));
  const [state, formAction, pending] = useActionState(saveQuestionsAction.bind(null, campaignId), {});
  const dirty = JSON.stringify(toPayload(rows)) !== JSON.stringify(toPayload(toRows(questions)));

  const update = (index: number, patch: Partial<Row>) => setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const move = (index: number, direction: -1 | 1) =>
    setRows((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  const remove = (index: number) => setRows((current) => current.filter((_, i) => i !== index));
  const add = () => setRows((current) => [...current, { key: crypto.randomUUID(), text: "", type: "open", options: "", required: true, source: "manual" }]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="questions" value={JSON.stringify(toPayload(rows))} />
      {rows.length === 0 && <p className="text-sm text-muted-foreground">{copy.empty}</p>}
      <ol className="space-y-4">
        {rows.map((row, index) => (
          <li key={row.key} className="space-y-4 rounded-lg border p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="pt-2 text-sm tabular-nums text-muted-foreground">{index + 1}.</span>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="icon" aria-label={copy.moveUp} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp aria-hidden="true" /></Button>
                <Button type="button" variant="ghost" size="icon" aria-label={copy.moveDown} disabled={index === rows.length - 1} onClick={() => move(index, 1)}><ArrowDown aria-hidden="true" /></Button>
                <Button type="button" variant="ghost" size="icon" aria-label={copy.remove} onClick={() => remove(index)}><Trash2 aria-hidden="true" /></Button>
              </div>
            </div>
            <div className="space-y-2"><Label htmlFor={`q-${row.key}-text`}>{copy.question}</Label><Textarea id={`q-${row.key}-text`} value={row.text} onChange={(event) => update(index, { text: event.target.value })} className="min-h-20" maxLength={500} required /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`q-${row.key}-type`}>{copy.type}</Label>
                <NativeSelect id={`q-${row.key}-type`} value={row.type} onChange={(event) => update(index, { type: event.target.value as QuestionType })} className="w-full">
                  {(Object.keys(questionTypeLabels) as QuestionType[]).map((type) => <NativeSelectOption key={type} value={type}>{questionTypeLabels[type]}</NativeSelectOption>)}
                </NativeSelect>
              </div>
              <div className="flex items-center gap-3 sm:pt-7">
                <Switch id={`q-${row.key}-required`} checked={row.required} onCheckedChange={(checked) => update(index, { required: checked })} />
                <Label htmlFor={`q-${row.key}-required`} className="font-normal">{row.required ? copy.required : copy.optional}</Label>
              </div>
            </div>
            {row.type === "choice" && (
              <div className="space-y-2"><Label htmlFor={`q-${row.key}-options`}>{copy.options}</Label><p id={`q-${row.key}-options-hint`} className="text-sm text-muted-foreground">{copy.optionsHint}</p><Textarea id={`q-${row.key}-options`} aria-describedby={`q-${row.key}-options-hint`} value={row.options} onChange={(event) => update(index, { options: event.target.value })} className="min-h-20" /></div>
            )}
          </li>
        ))}
      </ol>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={add}><Plus aria-hidden="true" />{copy.add}</Button>
        <Button type="submit" disabled={pending || !dirty}>{pending ? copy.saving : copy.save}</Button>
        {dirty && <Button type="button" variant="ghost" disabled={pending} onClick={() => setRows(toRows(questions))}>{copy.reset}</Button>}
        {dirty && <span className="text-sm text-muted-foreground">{copy.unsaved}</span>}
      </div>
    </form>
  );
}
