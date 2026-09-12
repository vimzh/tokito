"use client";

import { useState, useTransition } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateReportAction } from "@/actions/reports";
import { campaignContent } from "@/data/campaign";

const copy = campaignContent.reportView;

export function GenerateReportButton({ campaignId, hasReport, disabled }: { campaignId: string; hasReport: boolean; disabled: boolean }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant={hasReport ? "outline" : "default"} disabled={disabled || pending} onClick={() => startTransition(async () => setError((await generateReportAction(campaignId)).error))}>
        <FileText aria-hidden="true" />{pending ? copy.generating : hasReport ? copy.regenerate : copy.generate}
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
