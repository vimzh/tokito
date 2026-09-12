import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from '../db'
import { reportQuestions } from '../db/schema'
import type { StructuredRun } from '../ai/agent'
import { buildEvidencePack, renderEvidence, type EvidenceItem } from './evidence'
import { ReportError, type ReportQuote } from './generate'

export const askOutputSchema = z.object({
  answer: z.string().describe('A direct answer in two to five sentences, grounded only in the cited evidence. If the evidence cannot answer, say so plainly.'),
  evidence_ids: z.array(z.string()).describe('Ids of the evidence items the answer rests on.'),
  confidence: z.enum(['low', 'medium', 'high']),
  not_enough_evidence: z.boolean().describe('True when the evidence does not cover the question.'),
})

export const askInstructions = `You answer an organizer's question using only the evidence list from their phone campaign. Cite evidence ids for every claim. If the evidence does not cover the question, set not_enough_evidence to true and say what is missing instead of guessing. Never invent numbers; if asked how many, count the cited items and say the count is among the people who answered.`

export type AskResult = { id: string; question: string; answer: string; confidence: 'low' | 'medium' | 'high'; notEnoughEvidence: boolean; citations: ReportQuote[]; model: string; createdAt: number }

const toQuote = (item: EvidenceItem): ReportQuote => ({ evidenceId: item.id, answerId: item.answerId, callId: item.callId, person: item.person, simulated: item.simulated, questionText: item.questionText, status: item.status, value: item.value, notes: item.notes })

export async function askReport(db: Db, campaignId: string, question: string, run: StructuredRun): Promise<AskResult> {
  const pack = buildEvidencePack(db, campaignId)
  if (pack.results.responses.total === 0) throw new ReportError('There are no completed calls to ask about yet.')
  const { output, model } = await run({ system: askInstructions, prompt: `${renderEvidence(pack)}\n\nQUESTION: ${question}`, schema: askOutputSchema })
  const byId = new Map(pack.items.map((item) => [item.id, item]))
  const citations = [...new Set(output.evidence_ids)].map((evidenceId) => byId.get(evidenceId)).filter((item): item is EvidenceItem => Boolean(item)).map(toQuote)
  const now = Date.now()
  const result: AskResult = { id: crypto.randomUUID(), question, answer: output.answer, confidence: output.confidence, notEnoughEvidence: output.not_enough_evidence || citations.length === 0, citations, model, createdAt: now }
  db.insert(reportQuestions).values({ id: result.id, campaignId, question, answer: result as unknown as Record<string, unknown>, model, createdAt: now }).run()
  return result
}

export function listReportQuestions(db: Db, campaignId: string): AskResult[] {
  return db
    .select()
    .from(reportQuestions)
    .where(eq(reportQuestions.campaignId, campaignId))
    .orderBy(desc(reportQuestions.createdAt))
    .all()
    .map((row) => row.answer as unknown as AskResult)
}
