"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { settingsContent as copy } from "@/data/workspace-settings";

export function SettingsMockup() {
  const [settings, setSettings] = useState(copy.defaults);
  const [saved, setSaved] = useState(false);

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = event.currentTarget.elements;
    const start = fields.namedItem("start") as HTMLInputElement;
    const end = fields.namedItem("end") as HTMLInputElement;
    end.setCustomValidity(end.value <= start.value ? copy.invalidHours : "");
    if (!event.currentTarget.reportValidity()) return;
    const data = new FormData(event.currentTarget);
    setSettings({ language: String(data.get("language")), duration: String(data.get("duration")), start: start.value, end: end.value });
    setSaved(true);
  }

  return (
    <div className="max-w-3xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl sm:text-4xl">{copy.title}</h1>
        <p className="text-muted-foreground">{copy.description}</p>
        <p className="text-sm text-muted-foreground">{copy.notice}</p>
      </header>
      <Card>
        <CardHeader className="gap-2">
          <h2 className="text-xl">{copy.section}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{copy.sectionDescription}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} onChange={(event) => { setSaved(false); (event.currentTarget.elements.namedItem("end") as HTMLInputElement).setCustomValidity(""); }} className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="language">{copy.language}</Label>
                <NativeSelect id="language" name="language" defaultValue={settings.language} className="w-full">
                  {copy.languages.map((language) => <NativeSelectOption key={language} value={language}>{language}</NativeSelectOption>)}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">{copy.duration}</Label>
                <NativeSelect id="duration" name="duration" defaultValue={settings.duration} className="w-full">
                  {copy.durations.map((duration) => <NativeSelectOption key={duration.value} value={duration.value}>{duration.label}</NativeSelectOption>)}
                </NativeSelect>
              </div>
              <div className="space-y-2"><Label htmlFor="start">{copy.start}</Label><Input id="start" name="start" type="time" required defaultValue={settings.start} /></div>
              <div className="space-y-2"><Label htmlFor="end">{copy.end}</Label><Input id="end" name="end" type="time" required defaultValue={settings.end} /></div>
            </div>
            <p className="text-sm text-muted-foreground">{copy.timezone}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit">{copy.save}</Button>
              <p role="status" className="text-sm text-muted-foreground">{saved ? copy.saved : ""}</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
