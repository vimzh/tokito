"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { removeCampaignConnectionAction, runConnectionAction, saveCampaignConnectionAction, type ConnectionState } from "@/actions/connections";
import { campaignContent } from "@/data/campaign";
import { formatDateTime } from "@/lib/format";
import type { CampaignConnection, CampaignConnectionKind, ConnectionStatus } from "@/lib/api";

const copy = campaignContent.connections;
const kinds: CampaignConnectionKind[] = ["sheets", "calendar", "notion"];
const providerFor: Record<CampaignConnectionKind, "google" | "notion"> = { sheets: "google", calendar: "google", notion: "notion" };

export function CampaignConnections({ campaignId, connections, accounts, hasReport }: { campaignId: string; connections: CampaignConnection[]; accounts: ConnectionStatus[]; hasReport: boolean }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {kinds.map((kind) => (
        <ConnectionCard key={kind} campaignId={campaignId} kind={kind} row={connections.find((item) => item.kind === kind) ?? null} account={accounts.find((item) => item.provider === providerFor[kind])} hasReport={hasReport} />
      ))}
    </div>
  );
}

function ConnectionCard({ campaignId, kind, row, account, hasReport }: { campaignId: string; kind: CampaignConnectionKind; row: CampaignConnection | null; account?: ConnectionStatus; hasReport: boolean }) {
  const meta = copy.kinds[kind];
  const [state, formAction, saving] = useActionState(saveCampaignConnectionAction.bind(null, campaignId, kind), {} as ConnectionState);
  const [result, setResult] = useState<ConnectionState>({});
  const [pending, startTransition] = useTransition();
  const connected = Boolean(account?.connected);
  const value = row?.config.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${row.config.spreadsheetId}` : row?.config.parentPageId ? `https://www.notion.so/${row.config.parentPageId.replace(/-/g, "")}` : "";
  const run = (command: "sheet_import" | "sheet_sync" | "notion_publish") => startTransition(async () => setResult(await runConnectionAction(campaignId, command)));

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg">{meta.title}</h3>
          {row?.lastStatus && <Badge variant={row.lastStatus === "ok" ? "secondary" : "destructive"}>{copy.status[row.lastStatus]}</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">{meta.description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!connected ? (
          <p className="text-sm text-muted-foreground">{copy.needsAccount(providerFor[kind] === "google" ? "Google" : "Notion")} <Link href="/connections" className="underline-offset-4 hover:underline">{campaignContent.connections.open}</Link></p>
        ) : kind === "calendar" ? (
          row ? (
            <Button variant="outline" size="sm" disabled={pending} onClick={() => startTransition(async () => setResult(await removeCampaignConnectionAction(campaignId, kind)))}>{copy.remove}</Button>
          ) : (
            <form action={formAction}><Button type="submit" size="sm" disabled={saving}>{saving ? copy.saving : copy.enable}</Button></form>
          )
        ) : (
          <form action={formAction} className="space-y-3">
            <div className="space-y-2"><Label htmlFor={`conn-${kind}-url`}>{meta.urlLabel}</Label><Input id={`conn-${kind}-url`} name="url" defaultValue={value} placeholder={meta.placeholder} required /></div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={saving}>{saving ? copy.saving : copy.save}</Button>
              {row && <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => startTransition(async () => setResult(await removeCampaignConnectionAction(campaignId, kind)))}>{copy.remove}</Button>}
            </div>
          </form>
        )}
        {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
        {row && connected && kind === "sheets" && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => run("sheet_import")}>{copy.importFromSheet}</Button>
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => run("sheet_sync")}>{copy.syncNow}</Button>
          </div>
        )}
        {row && connected && kind === "notion" && <Button type="button" variant="outline" size="sm" disabled={pending || !hasReport} onClick={() => run("notion_publish")}>{copy.publish}</Button>}
        {pending && <p className="text-sm text-muted-foreground">{copy.working}</p>}
        {result.error && <p role="alert" className="text-sm text-destructive">{result.error}</p>}
        {result.message && <p className="text-sm text-muted-foreground">{result.message}</p>}
        {row && (
          <p className="text-xs text-muted-foreground">
            {row.lastSyncAt ? copy.lastAt(formatDateTime(row.lastSyncAt)) : copy.never}
            {row.lastError ? ` · ${row.lastError}` : ""}
            {row.lastExternalUrl ? <> · <a href={row.lastExternalUrl} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">{copy.open}</a></> : null}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
