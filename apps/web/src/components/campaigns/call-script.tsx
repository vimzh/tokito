"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { campaignContent } from "@/data/campaign";
import type { TaskPreview } from "@/lib/api";

const copy = campaignContent.script;

export function CallScript({ preview }: { preview: TaskPreview }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="space-y-3">
      <p className="text-sm text-muted-foreground">{copy.description} {copy.schemaNote(preview.questionCount)}</p>
      <CollapsibleTrigger asChild><Button variant="outline">{open ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}{open ? copy.hide : copy.show}</Button></CollapsibleTrigger>
      <CollapsibleContent><pre className="max-h-[60svh] overflow-auto whitespace-pre-wrap rounded-lg border bg-card p-4 font-sans text-sm leading-6">{preview.task}</pre></CollapsibleContent>
    </Collapsible>
  );
}
