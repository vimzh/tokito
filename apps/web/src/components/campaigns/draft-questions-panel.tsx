"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { draftQuestionsAction, saveQuestionsAction } from "@/actions/campaigns";
import { campaignContent, questionTypeLabels } from "@/data/campaign";
import type { DraftResult } from "@/lib/api";

const copy = campaignContent.draft;

export function DraftQuestionsPanel({ campaignId, existingCount }: { campaignId: string; existingCount: number }) {
  const [draft, setDraft] = useState<DraftResult>();
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function requestDraft() {
    setError(undefined);
    startTransition(async () => {
      const result = await draftQuestionsAction(campaignId);
      setError(result.error);
      setDraft(result.draft);
    });
  }

  function accept() {
    if (!draft) return;
    const formData = new FormData();
    formData.set("questions", JSON.stringify(draft.questions.map(({ text, type, options, required }) => ({ text, type, options, required, source: "ai" }))));
    formData.set("draft", JSON.stringify({ model: draft.model, promptVersion: draft.promptVersion }));
    startTransition(async () => {
      const result = await saveQuestionsAction(campaignId, {}, formData);
      setError(result.error);
      if (!result.error) setDraft(undefined);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" disabled={pending} onClick={requestDraft}><Sparkles aria-hidden="true" />{pending && !draft ? copy.working : existingCount > 0 ? copy.redraft : copy.button}</Button>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      {draft && (
        <Card>
          <CardHeader className="gap-1">
            <h3 className="text-lg">{copy.title}</h3>
            <p className="text-sm text-muted-foreground">{copy.description} {copy.model(draft.model)}.</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <ol className="list-decimal space-y-4 pl-5">
              {draft.questions.map((question, index) => (
                <li key={index} className="space-y-1 pl-2">
                  <p className="leading-6">{question.text}</p>
                  <p className="text-sm text-muted-foreground">{questionTypeLabels[question.type]}{question.options.length > 0 ? `: ${question.options.join(", ")}` : ""}{question.required ? "" : ` · ${campaignContent.editor.optional}`}</p>
                  <p className="text-sm text-muted-foreground">{copy.purpose}: {question.purpose}</p>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-3">
              <Button type="button" disabled={pending} onClick={() => (existingCount > 0 ? setConfirming(true) : accept())}>{copy.accept}</Button>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setDraft(undefined)}>{copy.discard}</Button>
            </div>
          </CardContent>
        </Card>
      )}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{copy.replaceTitle}</AlertDialogTitle><AlertDialogDescription>{copy.replaceDescription(existingCount)}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{campaignContent.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={accept}>{copy.replaceConfirm}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
