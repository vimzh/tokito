"use client";

import { useState, useTransition, type FormEvent } from "react";
import { PhoneCall, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Message, MessageContent } from "@/components/ui/message";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { AnswersTable } from "@/components/campaigns/answers-table";
import { simulationTurnAction, startSimulationAction } from "@/actions/calls";
import { campaignContent } from "@/data/campaign";
import type { MappedResult } from "@/lib/api";

const copy = campaignContent.testCall;
const callCopy = campaignContent.calls;

type Line = { speaker: "assistant" | "person"; text: string };
type Choice = { id: string; name: string | null; phone: string | null };

export function TestCallDialog({ campaignId, contacts, disabled }: { campaignId: string; contacts: Choice[]; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState("");
  const [personName, setPersonName] = useState("");
  const [callId, setCallId] = useState<string>();
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<MappedResult>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function reset() {
    setCallId(undefined);
    setLines([]);
    setDraft("");
    setResult(undefined);
    setError(undefined);
  }

  function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const response = await startSimulationAction(campaignId, who ? { contactId: who } : { personName: personName.trim() || undefined });
      if (response.error || !response.started) return setError(response.error);
      setCallId(response.started.call.id);
      setLines([{ speaker: "assistant", text: response.started.turn.text }]);
    });
  }

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !callId) return;
    setDraft("");
    setError(undefined);
    setLines((current) => [...current, { speaker: "person", text }]);
    startTransition(async () => {
      const response = await simulationTurnAction(campaignId, callId, text);
      if (response.error || !response.turn) return setError(response.error);
      setLines((current) => [...current, { speaker: "assistant", text: response.turn!.assistantTurn.text }]);
      if (response.turn.ended && response.turn.result) setResult(response.turn.result);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <DialogTrigger asChild><Button variant="outline" disabled={disabled} title={disabled ? copy.noQuestions : undefined}><PhoneCall aria-hidden="true" />{copy.button}</Button></DialogTrigger>
      <DialogContent className="flex max-h-[90svh] flex-col sm:max-w-2xl">
        <DialogHeader><DialogTitle>{copy.title}</DialogTitle><DialogDescription>{copy.description}</DialogDescription></DialogHeader>
        {!callId ? (
          <form onSubmit={start} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="test-call-who">{copy.who}</Label>
              <NativeSelect id="test-call-who" value={who} onChange={(event) => setWho(event.target.value)} className="w-full">
                <NativeSelectOption value="">{copy.someone}</NativeSelectOption>
                {contacts.map((contact) => <NativeSelectOption key={contact.id} value={contact.id}>{contact.name || copy.personNamePlaceholder} · {contact.phone}</NativeSelectOption>)}
              </NativeSelect>
            </div>
            {!who && <div className="space-y-2"><Label htmlFor="test-call-name">{copy.personName}</Label><Input id="test-call-name" value={personName} onChange={(event) => setPersonName(event.target.value)} placeholder={copy.personNamePlaceholder} maxLength={120} /></div>}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter><Button type="submit" disabled={pending}>{pending ? copy.starting : copy.start}</Button></DialogFooter>
          </form>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg border p-4" aria-live="polite">
              {lines.map((line, index) => (
                <Message key={index} align={line.speaker === "person" ? "end" : "start"}>
                  <MessageContent><Bubble variant={line.speaker === "person" ? "default" : "secondary"}><BubbleContent>{line.text}</BubbleContent></Bubble></MessageContent>
                </Message>
              ))}
              {pending && <p className="text-sm text-muted-foreground">{copy.thinking}</p>}
              {result && <p className="text-sm text-muted-foreground">{copy.ended}</p>}
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {result ? (
              <div className="space-y-4 overflow-y-auto">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{callCopy.outcomes[result.outcome]}</Badge>
                  {result.callbackRequested && <Badge variant="outline">{copy.callback(result.callbackTime)}</Badge>}
                  {result.optOut && <Badge variant="outline">{copy.optOut}</Badge>}
                </div>
                {result.summary && <p className="text-sm"><span className="text-muted-foreground">{copy.summary}: </span>{result.summary}</p>}
                {result.requestsForOrganizer && <p className="text-sm"><span className="text-muted-foreground">{copy.requests}: </span>{result.requestsForOrganizer}</p>}
                <AnswersTable answers={result.answers} />
                <DialogFooter><Button type="button" variant="outline" onClick={reset}>{copy.another}</Button><Button type="button" onClick={() => { setOpen(false); reset(); }}>{copy.close}</Button></DialogFooter>
              </div>
            ) : (
              <form onSubmit={send} className="flex gap-2">
                <Label htmlFor="test-call-reply" className="sr-only">{copy.reply}</Label>
                <Input id="test-call-reply" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={copy.reply} disabled={pending} maxLength={2000} autoFocus />
                <Button type="submit" disabled={pending || !draft.trim()}><Send aria-hidden="true" />{copy.send}</Button>
              </form>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
