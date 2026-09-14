"use client";

import { useState, useTransition } from "react";
import { RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { draftQuestionsAction, redraftQuestionAction, saveQuestionsAction } from "@/actions/campaigns";
import { campaignContent, questionTypeLabels } from "@/data/campaign";
import type { DraftedQuestion, DraftResult } from "@/lib/api";

const copy = campaignContent.draft;
type DraftRow = DraftedQuestion & { key: string };
type Proposal = Omit<DraftResult, "questions"> & { questions: DraftRow[] };

export function DraftQuestionsPanel({ campaignId, existingCount }: { campaignId: string; existingCount: number }) {
  const [draft, setDraft] = useState<Proposal>();
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [regeneratingKey, setRegeneratingKey] = useState<string>();
  const [pending, startTransition] = useTransition();

  function requestDraft() {
    setError(undefined);
    setDrafting(true);
    startTransition(async () => {
      const result = await draftQuestionsAction(campaignId);
      setError(result.error);
      if (result.draft) setDraft({ ...result.draft, questions: result.draft.questions.map((question) => ({ ...question, key: crypto.randomUUID() })) });
      setDrafting(false);
    });
  }

  function regenerate(row: DraftRow) {
    if (!draft) return;
    setError(undefined);
    setRegeneratingKey(row.key);
    startTransition(async () => {
      const result = await redraftQuestionAction(campaignId, {
        currentQuestion: { text: row.text, type: row.type, options: row.options, required: row.required, purpose: row.purpose },
        otherQuestions: draft.questions.filter((question) => question.key !== row.key).map((question) => question.text),
      });
      setError(result.error);
      if (result.draft) {
        const replacement = result.draft.question;
        setDraft((current) => current ? { ...current, questions: current.questions.map((question) => question.key === row.key ? { ...replacement, key: row.key } : question) } : current);
      }
      setRegeneratingKey(undefined);
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
        <Button type="button" variant="outline" disabled={pending} onClick={requestDraft}>{drafting ? <Spinner /> : <Sparkles aria-hidden="true" />}{drafting ? copy.working : existingCount > 0 ? copy.redraft : copy.button}</Button>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      {drafting && !draft && (
        <Card aria-live="polite" aria-busy="true">
          <CardHeader className="gap-1">
            <h3 className="text-lg">{copy.title}</h3>
            <p className="text-sm text-muted-foreground">{copy.loadingDescription}</p>
          </CardHeader>
          <CardContent className="space-y-5">
            {[0, 1, 2, 3].map((index) => <div key={index} className="space-y-2 rounded-lg border p-4"><Skeleton className="h-5 w-4/5" /><Skeleton className="h-4 w-2/5" /><Skeleton className="h-4 w-3/5" /></div>)}
          </CardContent>
        </Card>
      )}
      {draft && (
        <Card>
          <CardHeader className="gap-1">
            <h3 className="text-lg">{copy.title}</h3>
            <p className="text-sm text-muted-foreground">{copy.description} {copy.model(draft.model)}.</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <ol className="list-decimal space-y-4 pl-5">
              {draft.questions.map((question) => (
                <li key={question.key} className="space-y-1 pl-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 leading-6">{question.text}</p>
                    <div className="flex gap-1">
                      <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => regenerate(question)}>{regeneratingKey === question.key ? <Spinner /> : <RefreshCw aria-hidden="true" />}{regeneratingKey === question.key ? copy.regenerating : copy.regenerate}</Button>
                      <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setDraft((current) => current ? { ...current, questions: current.questions.filter((row) => row.key !== question.key) } : current)}><Trash2 aria-hidden="true" />{copy.remove}</Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{questionTypeLabels[question.type]}{question.options.length > 0 ? `: ${question.options.join(", ")}` : ""}{question.required ? "" : ` · ${campaignContent.editor.optional}`}</p>
                  <p className="text-sm text-muted-foreground">{copy.purpose}: {question.purpose}</p>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-3">
              <Button type="button" disabled={pending || draft.questions.length === 0} onClick={() => (existingCount > 0 ? setConfirming(true) : accept())}>{copy.accept}</Button>
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
