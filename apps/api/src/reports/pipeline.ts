// Multi-agent report pipeline: analysts per question (in parallel) → synthesis → reviewer.
// Every stage cites evidence ids; code validates them afterwards in assembleReport.
import { z } from 'zod'
import type { StructuredRun } from '../ai/agent'
import { renderEvidence, type EvidencePack } from './evidence'
import { reportOutputSchema } from './generate'

export const PIPELINE_PROMPT_VERSION = 'report-v2-multiagent'

export const analystOutputSchema = z.object({
  findings: z
    .array(
      z.object({
        statement: z.string().describe('One finding about this question, close to what people said.'),
        kind: z.enum(['positive', 'problem', 'suggestion', 'other']),
        evidence_ids: z.array(z.string()).min(1).describe('Ids of the answers that support this finding.'),
      }),
    )
    .describe('Findings for this question only. Empty when nobody gave a usable answer.'),
  disagreement: z
    .object({
      description: z.string(),
      sides: z.array(z.object({ position: z.string(), evidence_ids: z.array(z.string()).min(1) })).min(2),
    })
    .nullable()
    .describe('Set when people gave clearly opposing answers to this question; otherwise null.'),
  requests: z.array(z.object({ description: z.string(), evidence_ids: z.array(z.string()).min(1) })).describe('Things people asked the organizer to do, if any.'),
  coverage_note: z.string().describe('One sentence on how many of the answers were usable and what was missing.'),
})

export const reviewOutputSchema = z.object({
  headline_supported: z.boolean(),
  headline_rewrite: z.string().describe('A corrected headline when the original claims more than the evidence shows; otherwise empty.'),
  themes: z.array(z.object({ index: z.number().int().min(0), supported: z.boolean(), reason: z.string(), drop_evidence_ids: z.array(z.string()) })),
  disagreements: z.array(z.object({ index: z.number().int().min(0), supported: z.boolean(), reason: z.string() })),
  requests: z.array(z.object({ index: z.number().int().min(0), supported: z.boolean(), reason: z.string() })),
  next_steps: z.array(z.object({ index: z.number().int().min(0), supported: z.boolean(), reason: z.string() })),
})

export type AnalystOutput = z.infer<typeof analystOutputSchema>
export type SynthesisOutput = z.infer<typeof reportOutputSchema>
export type ReviewOutput = z.infer<typeof reviewOutputSchema>
export type PipelineMeta = { analysts: number; synthesisModel: string; reviewerModel: string; review: { checked: number; removed: number; trimmedCitations: number; headlineRewritten: boolean } }

export const analystInstructions = `You are an analyst reading every answer people gave to ONE question in a phone campaign. Produce findings for this question only.

Rules:
- Every finding must cite the ids of the answers that support it, from the list you are given. Never cite anything else.
- Stay close to the person's words. Do not add causes, numbers, or opinions that are not in the answers.
- Group similar answers into one finding; keep a finding that only one person raised, and say so in the statement.
- Report a disagreement only when answers clearly oppose each other.
- Skipped, declined, unknown, and not-asked answers are gaps, not findings. Mention them in the coverage note.`

export const synthesisInstructions = `You write the findings section of a feedback report for the organizer of a phone campaign. Analysts have already produced findings per question, each citing answer ids. Merge them into what the organizer needs: cross-question themes, disagreements, requests, and next steps.

Rules:
- Cite only ids that appear in the analysts' findings or the evidence list. Never invent facts, numbers, or names. Counts are computed elsewhere.
- A theme combines findings that say the same thing across questions or people. Merge overlapping themes; aim for four to eight themes that each say something distinct. Keep a single-person theme only when it matters to the goal, and say so.
- Next steps are options for the organizer to consider, each tied to the evidence that motivates it.
- Keep the person's meaning when paraphrasing.
- Items marked [simulation] are text tests, not real calls; do not describe them as customers.`

export const reviewerInstructions = `You are a reviewer checking a draft report against the evidence list. For every theme, disagreement, request, and next step, decide whether the cited evidence actually supports the statement as written.

Rules:
- Mark an item unsupported when its statement goes beyond what the cited answers say, when it cites nothing relevant, or when it invents a cause, a number, or a name.
- For themes, list any cited ids that do not support the statement in drop_evidence_ids; keep the theme supported if at least one cited answer still supports it.
- Mark the headline unsupported when it claims more than the evidence shows, and write a corrected one.
- Be strict about facts and lenient about wording.`

export function evidenceForQuestion(pack: EvidencePack, questionId: string) {
  return pack.items.filter((item) => item.questionId === questionId)
}

export function renderAnalystPrompt(pack: EvidencePack, questionId: string) {
  const question = pack.questions.find((item) => item.id === questionId)!
  const items = evidenceForQuestion(pack, questionId)
  const lines = [`GOAL: ${pack.goal}`, `QUESTION (${question.type}): ${question.text}`, '', `ANSWERS (${items.length}); cite by id:`]
  for (const item of items) {
    const who = `${item.person ?? 'Unnamed'}${item.simulated ? ' [simulation]' : ''}`
    lines.push(`${item.id} | ${who} | ${item.status === 'answered' ? `"${item.value ?? ''}"${item.notes ? ` (notes: "${item.notes}")` : ''}` : `[${item.status}]`}`)
  }
  return lines.join('\n')
}

export function renderSynthesisPrompt(pack: EvidencePack, analyses: { questionId: string; output: AnalystOutput }[]) {
  const lines = [renderEvidence(pack), '', 'ANALYST FINDINGS PER QUESTION:']
  for (const analysis of analyses) {
    const question = pack.questions.find((item) => item.id === analysis.questionId)
    lines.push('', `Question: ${question?.text ?? analysis.questionId}`, `Coverage: ${analysis.output.coverage_note}`)
    for (const finding of analysis.output.findings) lines.push(`- [${finding.kind}] ${finding.statement} (${finding.evidence_ids.join(', ')})`)
    if (analysis.output.disagreement) lines.push(`- disagreement: ${analysis.output.disagreement.description}: ${analysis.output.disagreement.sides.map((side) => `${side.position} (${side.evidence_ids.join(', ')})`).join(' vs ')}`)
    for (const request of analysis.output.requests) lines.push(`- request: ${request.description} (${request.evidence_ids.join(', ')})`)
  }
  return lines.join('\n')
}

export function renderReviewPrompt(pack: EvidencePack, draft: SynthesisOutput) {
  const lines = [renderEvidence(pack), '', 'DRAFT REPORT TO CHECK:', `Headline: ${draft.headline}`]
  draft.themes.forEach((theme, index) => lines.push(`theme[${index}] (${theme.kind}) ${theme.title}: ${theme.description} — cites ${theme.evidence_ids.join(', ') || 'nothing'}`))
  draft.disagreements.forEach((item, index) => lines.push(`disagreement[${index}] ${item.topic}: ${item.description} — ${item.sides.map((side) => `${side.position} (${side.evidence_ids.join(', ')})`).join(' vs ')}`))
  draft.requests.forEach((item, index) => lines.push(`request[${index}] ${item.description} — cites ${item.evidence_ids.join(', ') || 'nothing'}`))
  draft.next_steps.forEach((item, index) => lines.push(`next_step[${index}] ${item.suggestion} — cites ${item.evidence_ids.join(', ') || 'nothing'}`))
  return lines.join('\n')
}

// Applies the reviewer's verdicts to the draft. Unsupported items are removed; rejected citations are trimmed.
export function applyReview(draft: SynthesisOutput, review: ReviewOutput): { output: SynthesisOutput; stats: PipelineMeta['review'] } {
  let removed = 0
  let trimmed = 0
  const verdict = <T extends { index: number; supported: boolean }>(list: T[], index: number) => list.find((item) => item.index === index)
  const themes = draft.themes
    .map((theme, index) => {
      const v = verdict(review.themes, index)
      if (!v) return theme
      if (!v.supported) {
        removed += 1
        return null
      }
      const drop = new Set(v.drop_evidence_ids)
      const kept = theme.evidence_ids.filter((id) => !drop.has(id))
      trimmed += theme.evidence_ids.length - kept.length
      if (kept.length === 0) {
        removed += 1
        return null
      }
      return { ...theme, evidence_ids: kept }
    })
    .filter((theme): theme is SynthesisOutput['themes'][number] => theme !== null)
  const keep = <T>(list: T[], verdicts: { index: number; supported: boolean }[]) =>
    list.filter((_, index) => {
      const v = verdict(verdicts, index)
      if (v && !v.supported) {
        removed += 1
        return false
      }
      return true
    })
  const output: SynthesisOutput = {
    headline: review.headline_supported || !review.headline_rewrite.trim() ? draft.headline : review.headline_rewrite.trim(),
    themes,
    disagreements: keep(draft.disagreements, review.disagreements),
    requests: keep(draft.requests, review.requests),
    next_steps: keep(draft.next_steps, review.next_steps),
  }
  const checked = draft.themes.length + draft.disagreements.length + draft.requests.length + draft.next_steps.length
  return { output, stats: { checked, removed, trimmedCitations: trimmed, headlineRewritten: !review.headline_supported && Boolean(review.headline_rewrite.trim()) } }
}

export async function runReportPipeline(pack: EvidencePack, run: StructuredRun): Promise<{ output: SynthesisOutput; meta: PipelineMeta }> {
  const questionsWithEvidence = pack.questions.filter((question) => evidenceForQuestion(pack, question.id).length > 0)
  const analyses = await Promise.all(
    questionsWithEvidence.map(async (question) => ({
      questionId: question.id,
      output: (await run({ system: analystInstructions, prompt: renderAnalystPrompt(pack, question.id), schema: analystOutputSchema, effort: 'low' })).output,
    })),
  )
  const synthesis = await run({ system: synthesisInstructions, prompt: renderSynthesisPrompt(pack, analyses), schema: reportOutputSchema, effort: 'medium' })
  const review = await run({ system: reviewerInstructions, prompt: renderReviewPrompt(pack, synthesis.output), schema: reviewOutputSchema, effort: 'medium' })
  const applied = applyReview(synthesis.output, review.output)
  return { output: applied.output, meta: { analysts: analyses.length, synthesisModel: synthesis.model, reviewerModel: review.model, review: applied.stats } }
}
