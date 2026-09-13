"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { disconnectAction } from "@/actions/connections";
import { connectionsContent as copy } from "@/data/workspace-settings";
import type { ConnectionStatus } from "@/lib/api";

export function ConnectionsPanel({ connections, notice, apiBase }: { connections: ConnectionStatus[]; notice?: { kind: "ok" | "error"; text: string }; apiBase: string }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl sm:text-4xl">{copy.title}</h1>
        <p className="text-muted-foreground">{copy.description}</p>
        <p className="text-sm text-muted-foreground">{copy.intro}</p>
      </header>
      {notice && <p role="status" className={notice.kind === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{notice.text}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {connections.map((connection) => {
          const meta = copy.providers[connection.provider];
          return (
            <Card key={connection.provider} className="justify-between">
              <CardHeader className="gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl">{meta.title}</h2><Badge variant={connection.connected ? "secondary" : "outline"}>{connection.connected ? copy.connected(connection.accountLabel) : copy.notConnected}</Badge></div>
              </CardHeader>
              <CardContent className="flex-1 text-sm leading-relaxed text-muted-foreground">{meta.description}{!connection.configured && <span className="mt-2 block">{copy.notConfigured}</span>}</CardContent>
              <CardFooter>
                {connection.connected ? (
                  <Button variant="outline" disabled={pending} onClick={() => startTransition(async () => setError((await disconnectAction(connection.provider)).error))}>{pending ? copy.disconnecting : copy.disconnect}</Button>
                ) : (
                  <Button asChild disabled={!connection.configured}><a href={connection.configured ? `${apiBase}/api/connections/${connection.provider}/start?returnTo=${encodeURIComponent("/connections")}` : "#"} aria-disabled={!connection.configured}>{copy.connect}</a></Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground">{copy.planned}</p>
    </div>
  );
}
