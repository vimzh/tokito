import { desc, eq, and } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from '../db'
import { campaignEvents, reports, type Report } from '../db/schema'
import type { StructuredRun } from '../ai/agent'
import { NotFoundError } from '../services/campaigns'
import { buildEvidencePack, renderEvidence, type EvidenceItem, type EvidencePack } from './evidence'

export const REPORT_PROMPT_VERSION = 'report-v1'

export class ReportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReportError'
  }
}

const id = () => crypto.randomUUID()

export const reportOutputSchema = z.object({
  headline: z.string().describe('Two or three sentences on what the responses say overall. No numbers.'),
  themes: z
    .array(
      z.object({
        title: z.string().describe('Short label for the theme.'),
        kind: z.enum(['positive', 'problem', 'suggestion', 'other']),
        description: z.string().describe('One or two sentences on what people said about this and why. No invented details.'),
        evidence_ids: z.array(z.string()).describe('Ids of the evidence items that support this theme.'),
      }),
    )
    .describe('Recurring patterns across people. Only themes with evidence.'),
  disagreements: z.array(
    z.object({
      topic: z.string(),
      description: z.string(),
      sides: z.array(z.object({ position: z.string(), evidence_ids: z.array(z.string()) })).min(2),
    }),
  ),
  requests: z.array(z.object({ description: z.string(), evidence_ids: z.array(z.string()) })).describe('Things people asked the organizer to do or send.'),
  next_steps: z.array(z.object({ suggestion: z.string(), evidence_ids: z.array(z.string()) })).describe('Actions the evidence supports. Each must cite evidence.'),
})

export type ReportQuote = { evidenceId: string; answerId: string; callId: string; person: string | null; simulated: boolean; questionText: string; status: EvidenceItem['status']; value: string | null; notes: string | null }
export type ReportTheme = { title: string; kind: 'positive' | 'problem' | 'suggestion' | 'other'; description: string; peopleCount: number; quotes: ReportQuote[] }
export type ReportContent = {
  headline: string
  themes: ReportTheme[]
  disagreements: { topic: string; description: string; sides: { position: string; peopleCount: number; quotes: ReportQuote[] }[] }[]
  requests: { description: string; quotes: ReportQuote[] }[]
  nextSteps: { suggestion: string; quotes: ReportQuote[] }[]
  gaps: { questionId: string; questionText: string; skipped: number; declined: number; unknown: number; notAsked: number; missing: number }[]
  participation: EvidencePack['results']['participation']
  responses: EvidencePack['results']['responses']
  questions: EvidencePack['results']['questions']
  droppedCitations: number
}

export const reportInstructions = `You write the findings section of a feedback report for the organizer of a phone campaign. You are given the goal, the questions, and an evidence list where every item has an id.

Rules:
- Only describe what the evidence says. Never add facts, numbers, or opinions of your own. Counts are computed elsewhere.
- Every theme, disagreement side, request, and next step must cite evidence ids from the list. Cite only ids that exist. Do not cite call summaries.
- Group by what people actually said, not by question. A theme needs support from the evidence; if only one person raised something, it can still be a theme, but say so in the description.
- Keep the person's meaning; when you paraphrase, stay close to their words.
- Next steps are suggestions for the organizer to consider, phrased as options, each tied to the evidence that motivates it.
- Items marked [simulation] are text tests, not real calls; treat them as evidence but do not pretend they are customers.`

const toQuote = (item: EvidenceItem): ReportQuote => ({ evidenceId: item.id, answerId: item.answerId, callId: item.callId, person: item.person, simulated: item.simulated, questionText: item.questionText, status: item.status, value: item.value, notes: item.notes })

// Validates citations, counts distinct people from the rows, and merges database-computed sections.
export function assembleReport(pack: EvidencePack, output: z.infer<typeof reportOutputSchema>): ReportContent {
  const byId = new Map(pack.items.map((item) => [item.id, item]))
  let dropped = 0
  const resolve = (ids: string[]) => {
    const unique = [...new Set(ids)]
    const items = unique.map((evidenceId) => byId.get(evidenceId)).filter((item): item is EvidenceItem => Boolean(item))
    dropped += unique.length - items.length
    return items
  }
  const people = (items: EvidenceItem[]) => new Set(items.map((item) => item.contactId ?? item.callId)).size
  const themes = output.themes
    .map((theme) => {
      const items = resolve(theme.evidence_ids)
      return { title: theme.title, kind: theme.kind, description: theme.description, peopleCount: people(items), quotes: items.map(toQuote) }
    })
    .filter((theme) => theme.quotes.length > 0)
  const disagreements = output.disagreements
    .map((item) => ({
      topic: item.topic,
      description: item.description,
      sides: item.sides.map((side) => {
        const items = resolve(side.evidence_ids)
        return { position: side.position, peopleCount: people(items), quotes: items.map(toQuote) }
      }).filter((side) => side.quotes.length > 0),
    }))
    .filter((item) => item.sides.length >= 2)
  const requests = output.requests.map((item) => ({ description: item.description, quotes: resolve(item.evidence_ids).map(toQuote) })).filter((item) => item.quotes.length > 0)
  const nextSteps = output.next_steps.map((item) => ({ suggestion: item.suggestion, quotes: resolve(item.evidence_ids).map(toQuote) })).filter((item) => item.quotes.length > 0)
  const gaps = pack.results.questions
    .map((question) => ({ questionId: question.id, questionText: question.text, skipped: question.statusCounts.skipped, declined: question.statusCounts.declined, unknown: question.statusCounts.unknown, notAsked: question.statusCounts.not_asked, missing: question.statusCounts.missing }))
    .filter((gap) => gap.skipped + gap.declined + gap.unknown + gap.notAsked + gap.missing > 0)
  return { headline: output.headline, themes, disagreements, requests, nextSteps, gaps, participation: pack.results.participation, responses: pack.results.responses, questions: pack.results.questions, droppedCitations: dropped }
}

export async function generateReport(db: Db, campaignId: string, run: StructuredRun) {
  const pack = buildEvidencePack(db, campaignId)
  if (pack.results.responses.total === 0) throw new ReportError('There are no completed calls to report on yet.')
  const { output, model } = await run({ system: reportInstructions, prompt: renderEvidence(pack), schema: reportOutputSchema })
  const content = assembleReport(pack, output)
  const latest = db.select({ version: reports.version }).from(reports).where(eq(reports.campaignId, campaignId)).orderBy(desc(reports.version)).get()
  const now = Date.now()
  const row = { id: id(), campaignId, version: (latest?.version ?? 0) + 1, model, promptVersion: REPORT_PROMPT_VERSION, content: content as unknown as Record<string, unknown>, createdAt: now }
  db.transaction((tx) => {
    tx.insert(reports).values(row).run()
    tx.insert(campaignEvents).values({ id: id(), campaignId, type: 'report.generated', payload: { version: row.version, model, droppedCitations: content.droppedCitations }, createdAt: now }).run()
  })
  return { ...row, content }
}

export function getReport(db: Db, campaignId: string, version?: number) {
  const versions = db.select({ version: reports.version, createdAt: reports.createdAt, model: reports.model }).from(reports).where(eq(reports.campaignId, campaignId)).orderBy(desc(reports.version)).all()
  const wanted = version ?? versions[0]?.version
  const row = wanted === undefined ? undefined : db.select().from(reports).where(and(eq(reports.campaignId, campaignId), eq(reports.version, wanted))).get()
  if (version !== undefined && !row) throw new NotFoundError('Report version not found')
  return { report: row ? ({ ...row, content: row.content as unknown as ReportContent } as Omit<Report, 'content'> & { content: ReportContent }) : null, versions }
}
