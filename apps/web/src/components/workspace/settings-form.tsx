"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PreferencesFields } from "@/components/campaigns/preferences-fields";
import { OptOutList } from "@/components/workspace/opt-out-list";
import { updateSettingsAction } from "@/actions/settings";
import { settingsContent as copy } from "@/data/workspace-settings";
import type { OptOut, WorkspaceSettings } from "@/lib/api";

export function SettingsForm({ settings, optOuts }: { settings: WorkspaceSettings; optOuts: OptOut[] }) {
  const [state, formAction, pending] = useActionState(updateSettingsAction, {});
  return (
    <div className="max-w-3xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl sm:text-4xl">{copy.title}</h1>
        <p className="text-muted-foreground">{copy.description}</p>
      </header>
      <Card>
        <CardHeader className="gap-2">
          <h2 className="text-xl">{copy.section}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{copy.sectionDescription}</p>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-6">
            <PreferencesFields values={settings} idPrefix="settings" />
            {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={pending}>{pending ? copy.saving : copy.save}</Button>
              <p role="status" className="text-sm text-muted-foreground">{state.saved && !pending ? copy.saved : ""}</p>
            </div>
          </form>
        </CardContent>
      </Card>
      <OptOutList optOuts={optOuts} />
    </div>
  );
}
