"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { newSurveyContent as copy } from "@/data/new-survey";

export function NewSurveyForm() {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [source, setSource] = useState("ai");
  const [approach, setApproach] = useState("dynamic");
  const [questions, setQuestions] = useState("");
  const [additional, setAdditional] = useState("");
  const [review, setReview] = useState(false);
  const [error, setError] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid = !name.trim() || !goal.trim() || (source === "manual" && !questions.trim());
    setError(invalid);
    if (!invalid) setReview(true);
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <header className="space-y-3">
        <Button asChild variant="ghost" className="-ml-3"><Link href="/home"><ArrowLeft aria-hidden="true" />{copy.back}</Link></Button>
        <h1 className="text-3xl sm:text-4xl">{review ? copy.reviewTitle : copy.title}</h1>
        <p className="text-sm text-muted-foreground">{review ? copy.reviewNote : copy.description}</p>
        <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">{copy.notice}</p>
      </header>
      {review ? (
        <section aria-label={copy.reviewTitle} className="space-y-6">
          <dl className="space-y-6 rounded-xl border p-6 text-sm">
            {[
              [copy.name, name.trim()],
              [copy.goal, goal.trim()],
              [copy.source, copy.sources.find((option) => option.value === source)?.title],
              [copy.approach, copy.approaches.find((option) => option.value === approach)?.title],
              [copy.questions, source === "manual" ? questions.trim() : copy.aiNote],
              [copy.additional, additional.trim() || copy.emptyAdditional],
            ].map(([label, value]) => (
              <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="mt-2 whitespace-pre-wrap break-words">{value}</dd></div>
            ))}
          </dl>
          <Button variant="outline" onClick={() => setReview(false)}>{copy.edit}</Button>
        </section>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8">
          <section className="space-y-5" aria-labelledby="survey-basics">
            <h2 id="survey-basics" className="text-xl">{copy.basics}</h2>
            <div className="space-y-2"><Label htmlFor="survey-name">{copy.name}</Label><Input id="survey-name" value={name} onChange={(event) => setName(event.target.value)} placeholder={copy.namePlaceholder} maxLength={120} required /></div>
            <div className="space-y-2"><Label htmlFor="survey-goal">{copy.goal}</Label><Textarea id="survey-goal" value={goal} onChange={(event) => setGoal(event.target.value)} placeholder={copy.goalPlaceholder} className="min-h-28" maxLength={2000} required /></div>
          </section>
          <section className="space-y-4" aria-labelledby="survey-source">
            <h2 id="survey-source" className="text-xl">{copy.source}</h2>
            <RadioGroup value={source} onValueChange={setSource} aria-labelledby="survey-source" className="grid gap-3 sm:grid-cols-2">
              {copy.sources.map((option) => (
                <Label key={option.value} htmlFor={`source-${option.value}`} className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-muted/40">
                  <RadioGroupItem id={`source-${option.value}`} value={option.value} className="mt-0.5" />
                  <span className="space-y-2"><span className="block">{option.title}</span><span className="block text-sm font-normal leading-relaxed text-muted-foreground">{option.description}</span></span>
                </Label>
              ))}
            </RadioGroup>
            {source === "manual" && <div className="space-y-2"><Label htmlFor="survey-questions">{copy.questions}</Label><p id="questions-hint" className="text-sm text-muted-foreground">{copy.questionsHint}</p><Textarea id="survey-questions" aria-describedby="questions-hint" value={questions} onChange={(event) => setQuestions(event.target.value)} placeholder={copy.questionsPlaceholder} className="min-h-36" maxLength={10000} required /></div>}
          </section>
          <section className="space-y-4" aria-labelledby="survey-approach">
            <h2 id="survey-approach" className="text-xl">{copy.approach}</h2>
            <RadioGroup value={approach} onValueChange={setApproach} aria-labelledby="survey-approach" className="grid gap-3 sm:grid-cols-2">
              {copy.approaches.map((option) => (
                <Label key={option.value} htmlFor={`approach-${option.value}`} className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-muted/40">
                  <RadioGroupItem id={`approach-${option.value}`} value={option.value} className="mt-0.5" />
                  <span className="space-y-2"><span className="block">{option.title}</span><span className="block text-sm font-normal leading-relaxed text-muted-foreground">{option.description}</span></span>
                </Label>
              ))}
            </RadioGroup>
          </section>
          <div className="space-y-3"><Label htmlFor="survey-additional">{copy.additional}</Label><p id="additional-hint" className="text-sm text-muted-foreground">{copy.additionalHint}</p><Textarea id="survey-additional" aria-describedby="additional-hint" value={additional} onChange={(event) => setAdditional(event.target.value)} placeholder={copy.additionalPlaceholder} className="min-h-28" maxLength={2000} /></div>
          {error && <p role="alert" className="text-sm text-destructive">{copy.invalid}</p>}
          <Button type="submit">{copy.preview}</Button>
        </form>
      )}
    </div>
  );
}
