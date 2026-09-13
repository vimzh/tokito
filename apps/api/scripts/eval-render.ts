// Renders an evaluation JSON file to Markdown. Used by eval.ts and runnable on its own:
//   bun run scripts/eval-render.ts ../../docs/evaluation/run-<stamp>.json
import { readFileSync, writeFileSync } from 'node:fs'

export function renderMarkdown(input: { stamp: string; mainModel: string; cheapModel: string; responses: number; scenarios: Record<string, unknown>[]; usage: Record<string, { calls: number; inputTokens: number; outputTokens: number; totalTokens: number }> }) {
  const { stamp, usage } = input
  const report = input.scenarios
  const md: string[] = [`# End-to-end evaluation run ${stamp}`, '', `Main model: ${input.mainModel}. Synthetic people, bulk responses, and turn classification: ${input.cheapModel}. Responses per scenario: ${input.responses}. CALL-E was not used; every call is a text simulation or a synthetic transcript passed through the real result mapper.`, '']
md.push('## Token usage', '', '| Model | Calls | Input tokens | Output tokens | Total |', '|---|---:|---:|---:|---:|')
for (const [model, u] of Object.entries(usage)) md.push(`| ${model} | ${u.calls} | ${u.inputTokens} | ${u.outputTokens} | ${u.totalTokens} |`)
md.push('')
for (const entry of report as Record<string, any>[]) {
  md.push(`## ${entry.name} (${entry.who})`, '', `Goal: ${entry.goal}`, '', `Scenario time: ${Math.round(entry.seconds)} s.`, '')
  md.push('### Drafted questions', '')
  entry.questions.forEach((q: any, i: number) => md.push(`${i + 1}. ${q.text} _(${q.type}${q.options?.length ? `: ${q.options.join(' / ')}` : ''}${q.required ? '' : ', optional'})_`))
  const qj = entry.questionJudge
  md.push('', `Judge: relevance ${qj.relevance}/5, not leading ${qj.not_leading}/5, screening ${qj.screening}/5, spoken ${qj.spoken}/5, length ${qj.length}/5.`)
  if (qj.issues.length) md.push('', 'Issues:', ...qj.issues.map((i: string) => `- ${i}`))
  if (qj.improvements.length) md.push('', 'Suggested improvements:', ...qj.improvements.map((i: string) => `- ${i}`))
  md.push('', '### Simulated calls (LLM plays the person)', '', '| Person | Mode | Turns | Prepared | Follow-ups | Clarifications | Outcome | Callback | Opt-out |', '|---|---|---:|---:|---:|---:|---|---|---|')
  for (const s of entry.simulations) md.push(`| ${s.persona.name} | ${s.persona.mode} | ${s.transcript.length} | ${s.counts.prepared_question} | ${s.counts.follow_up} | ${s.counts.clarification} | ${s.outcome ?? s.status} | ${s.callback ?? ''} | ${s.optOut ? 'yes' : ''} |`)
  const dyn = entry.simulations.find((s: any) => s.persona.mode === 'dynamic')
  const fix = entry.simulations.find((s: any) => s.persona.mode === 'fixed')
  for (const [label, s] of [['Dynamic', dyn], ['Fixed', fix]] as const) {
    if (!s) continue
    md.push('', `<details><summary>${label} transcript: ${s.persona.name} (${s.persona.card})</summary>`, '')
    for (const t of s.transcript) md.push(`> **${t.speaker === 'assistant' ? 'Assistant' : s.persona.name}:** ${t.text}`, '>')
    md.push('', 'Recorded answers:', '', ...s.answers.map((a: any) => `- ${a.q} → **${a.status}**${a.value ? `: ${a.value}` : ''}${a.notes ? ` _(${a.notes})_` : ''}`), '', `Summary: ${s.summary ?? ''}`, '', '</details>')
  }
  md.push('', '### Bulk responses through the result mapper', '', `${entry.bulk.inserted} synthetic calls; outcomes: ${Object.entries(entry.bulk.outcomes).map(([k, v]) => `${k} ${v}`).join(', ')}.`, '', `Participation: ${Object.entries(entry.results.participation).map(([k, v]) => `${k} ${v}`).join(', ')}. Responses counted: ${entry.results.responses.total}.`, '', '| Question | Answered | Skipped | Declined | Unknown | Not asked | Rating avg | Choice totals |', '|---|---:|---:|---:|---:|---:|---|---|')
  for (const q of entry.results.questions) md.push(`| ${q.text} | ${q.statusCounts.answered} | ${q.statusCounts.skipped} | ${q.statusCounts.declined} | ${q.statusCounts.unknown} | ${q.statusCounts.not_asked} | ${q.rating?.average ?? ''} | ${q.choice ? q.choice.totals.map((t: any) => `${t.option} ${t.count}`).join(', ') + (q.choice.other ? `, other ${q.choice.other}` : '') : ''} |`)
  const r = entry.report
  md.push('', '### Report (multi-agent pipeline)', '', `Generated in ${r.seconds.toFixed(1)} s. Analysts: ${r.pipeline?.analysts}. Reviewer removed ${r.pipeline?.review.removed} claims, trimmed ${r.pipeline?.review.trimmedCitations} citations${r.pipeline?.review.headlineRewritten ? ', rewrote the headline' : ''}. Dropped citations after code validation: ${r.droppedCitations}. Deterministic checks: ${r.problems.length ? r.problems.join('; ') : 'all passed'}.`, '', `**Headline (AI summary):** ${r.headline}`, '', '**Themes:**', '')
  for (const t of r.themes) md.push(`- **${t.title}** _(${t.kind}, ${t.peopleCount} people)_ — ${t.description}`, ...t.quotes.map((q: any) => `  - “${q.value ?? q.status}” — ${q.person ?? 'unnamed'}`))
  if (r.disagreements.length) md.push('', '**Disagreements:** ' + r.disagreements.map((d: any) => `${d.topic}: ${d.sides.map((s: any) => `${s.position} (${s.peopleCount})`).join(' vs ')}`).join('; '))
  if (r.requests.length) md.push('', '**Requests:** ' + r.requests.join('; '))
  md.push('', '**Gaps:** ' + (r.gaps.map((g: any) => `${g.questionText}: ${[g.skipped && `${g.skipped} skipped`, g.declined && `${g.declined} declined`, g.notAsked && `${g.notAsked} not asked`, g.missing && `${g.missing} no record`].filter(Boolean).join(', ')}`).join('; ') || 'none'))
  md.push('', '**Next steps (AI suggestions):**', ...r.nextSteps.map((s: any) => `- ${s.suggestion} _(${s.evidence} cited answers)_`))
  const j = r.judge
  md.push('', `Judge: faithfulness ${j.faithfulness}/5, coverage ${j.coverage}/5, usefulness ${j.usefulness}/5, honesty ${j.honesty}/5, summary ${j.summary_quality}/5.`)
  if (j.strengths.length) md.push('', 'Strengths:', ...j.strengths.map((i: string) => `- ${i}`))
  if (j.issues.length) md.push('', 'Issues:', ...j.issues.map((i: string) => `- ${i}`))
  if (j.missed_patterns.length) md.push('', 'Missed patterns:', ...j.missed_patterns.map((i: string) => `- ${i}`))
  md.push('', '### Ask the report', '')
  for (const a of entry.asks) md.push(`**Q:** ${a.question}`, '', `**A** _(${a.confidence}${a.notEnoughEvidence ? ', not enough evidence' : ''}, ${a.citations} citations, ${a.seconds.toFixed(1)} s)_: ${a.answer}`, '')
}
  return md.join('\n')
}

if (import.meta.main) {
  const file = process.argv[2]
  if (!file) throw new Error('Pass the JSON file to render.')
  const data = JSON.parse(readFileSync(file, 'utf8')) as { responsesPerScenario: number; cheapModel: string; mainModel: string; scenarios: Record<string, unknown>[]; usage: Record<string, { calls: number; inputTokens: number; outputTokens: number; totalTokens: number }> }
  const stamp = file.match(/run-(.+)\.json$/)?.[1] ?? 'render'
  writeFileSync(file.replace(/\.json$/, '.md'), renderMarkdown({ stamp, mainModel: data.mainModel, cheapModel: data.cheapModel, responses: data.responsesPerScenario, scenarios: data.scenarios, usage: data.usage }))
  console.log(`wrote ${file.replace(/\.json$/, '.md')}`)
}
