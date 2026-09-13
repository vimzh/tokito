import { beforeEach, describe, expect, test } from 'bun:test'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { createDb, type Db } from '../db'
import { answers, calls } from '../db/schema'
import type { StructuredRun } from '../ai/agent'
import { createCampaign, replaceQuestions } from '../services/campaigns'
import { commitImport, createImport, listContacts } from '../services/contacts'
import { campaignResults } from '../calls/results'
import { buildEvidencePack, renderEvidence } from './evidence'
import { assembleReport, generateReport, getReport, reportOutputSchema } from './generate'
import { askReport, listReportQuestions } from './ask'

let db: Db
let campaignId: string

beforeEach(() => {
  db = createDb(':memory:')
  migrate(db, { migrationsFolder: './drizzle' })
  campaignId = createCampaign(db, { name: 'Menu', goal: 'What do customers think of the new menu?', questionSource: 'manual', conversationMode: 'dynamic', questions: ['x'] }).id
  const qids = replaceQuestions(db, campaignId, { questions: [{ text: 'What did you think of the prices?', type: 'open', options: [], required: true, source: 'manual' }, { text: 'Rate the portions', type: 'rating', options: [], required: true, source: 'manual' }] }).questions.map((q) => q.id)
  const preview = createImport(db, campaignId, 'c.csv', new TextEncoder().encode('Name,Phone\nAsha,9876543210\nRavi,9876543211\n'))
  commitImport(db, campaignId, preview.id, { nameColumn: 0, phoneColumn: 1, contextColumns: [] })
  const [asha, ravi] = listContacts(db, campaignId).contacts
  const t = Date.UTC(2026, 8, 14, 7, 0)
  const add = (contactId: string, rows: [status: 'answered' | 'declined', value: string | null, num?: number][]) => {
    const callId = crypto.randomUUID()
    db.insert(calls).values({ id: callId, campaignId, contactId, provider: 'calle', providerCallId: `p_${callId}`, attempt: 1, status: 'completed', task: 't', resultSchema: {}, questionMap: {}, summary: 'Summary', startedAt: t, endedAt: t + 60_000, durationSeconds: 60, createdAt: t, updatedAt: t }).run()
    rows.forEach(([status, value, num], index) => db.insert(answers).values({ id: crypto.randomUUID(), callId, campaignId, contactId, questionId: qids[index]!, questionText: 'q', status, value, valueNumber: num ?? null, notes: null, createdAt: t }).run())
  }
  add(asha!.id, [['answered', 'Too expensive for the portion'], ['answered', '2', 2]])
  add(ravi!.id, [['answered', 'Fair for what you get'], ['declined', null]])
})

describe('evidence pack', () => {
  test('lists every answer with a short id and renders gaps', () => {
    const pack = buildEvidencePack(db, campaignId)
    expect(pack.items.map((item) => item.id)).toEqual(['e1', 'e2', 'e3', 'e4'])
    const text = renderEvidence(pack)
    expect(text).toContain('e1 | Asha | What did you think of the prices? | "Too expensive for the portion"')
    expect(text).toContain('[declined]')
    expect(text).toContain('2 completed responses')
  })
})

describe('assembleReport', () => {
  test('drops invalid citations, counts distinct people, and pulls gaps from the database', () => {
    const pack = buildEvidencePack(db, campaignId)
    const output = reportOutputSchema.parse({
      headline: 'Views on price differ.',
      themes: [
        { title: 'Price versus portion', kind: 'problem', description: 'One person found it expensive for the portion.', evidence_ids: ['e1', 'e1', 'e3', 'e99'] },
        { title: 'Ghost theme', kind: 'other', description: 'No support.', evidence_ids: ['e42'] },
      ],
      disagreements: [{ topic: 'Prices', description: 'Split views.', sides: [{ position: 'Too expensive', evidence_ids: ['e1'] }, { position: 'Fair', evidence_ids: ['e2'] }] }],
      requests: [],
      next_steps: [{ suggestion: 'Review portion sizes on the dishes people named.', evidence_ids: ['e1'] }, { suggestion: 'Unsupported idea.', evidence_ids: [] }],
    })
    const content = assembleReport(pack, output)
    expect(content.themes).toHaveLength(1)
    expect(content.themes[0]).toMatchObject({ peopleCount: 1, quotes: [{ evidenceId: 'e1', person: 'Asha', value: 'Too expensive for the portion' }, { evidenceId: 'e3', person: 'Asha', value: '2' }] })
    expect(content.droppedCitations).toBe(2)
    expect(content.disagreements[0]?.sides.map((side) => side.peopleCount)).toEqual([1, 1])
    expect(content.nextSteps).toHaveLength(1)
    expect(content.gaps).toEqual([{ questionId: pack.questions[1]!.id, questionText: 'Rate the portions', skipped: 0, declined: 1, unknown: 0, notAsked: 0, missing: 0 }])
    expect(content.participation).toEqual(campaignResults(db, campaignId).participation)
    expect(content.themes[0]!.quotes.every((quote) => quote.callId && quote.answerId)).toBe(true)
  })
})

describe('generate and ask', () => {
  const run: StructuredRun = async ({ schema, prompt }) => {
    if ('shape' in schema && 'headline' in (schema as { shape: Record<string, unknown> }).shape)
      return { output: schema.parse({ headline: 'H', themes: [{ title: 'T', kind: 'positive', description: 'D', evidence_ids: ['e2'] }], disagreements: [], requests: [], next_steps: [] }), model: 'fake' }
    const unanswerable = prompt.includes('QUESTION: What colour')
    return { output: schema.parse({ answer: unanswerable ? 'The evidence does not mention colour.' : 'Asha found it expensive.', evidence_ids: unanswerable ? [] : ['e1'], confidence: unanswerable ? 'low' : 'high', not_enough_evidence: unanswerable }), model: 'fake' }
  }

  test('stores versions and returns the latest by default', async () => {
    const first = await generateReport(db, campaignId, run, { mode: 'single' })
    const second = await generateReport(db, campaignId, run, { mode: 'single' })
    expect([first.version, second.version]).toEqual([1, 2])
    const latest = getReport(db, campaignId)
    expect(latest.report?.version).toBe(2)
    expect(latest.versions.map((v) => v.version)).toEqual([2, 1])
    expect(getReport(db, campaignId, 1).report?.version).toBe(1)
    expect(() => getReport(db, campaignId, 9)).toThrow('not found')
  })

  test('refuses without completed calls', async () => {
    const empty = createCampaign(db, { name: 'Empty', goal: 'g', questionSource: 'ai', conversationMode: 'dynamic' }).id
    await expect(generateReport(db, empty, run, { mode: 'single' })).rejects.toThrow('no completed calls')
  })

  test('ask resolves citations and keeps history; unanswerable questions say so', async () => {
    const answered = await askReport(db, campaignId, 'Who found it expensive?', run)
    expect(answered.citations).toHaveLength(1)
    expect(answered.citations[0]).toMatchObject({ person: 'Asha', evidenceId: 'e1' })
    expect(answered.notEnoughEvidence).toBe(false)
    const unknown = await askReport(db, campaignId, 'What colour is the menu?', run)
    expect(unknown.notEnoughEvidence).toBe(true)
    expect(listReportQuestions(db, campaignId).map((q) => q.question)).toEqual(['What colour is the menu?', 'Who found it expensive?'])
  })
})

describe('multi-agent pipeline', () => {
  test('runs one analyst per question with only its answers, synthesizes, and applies the reviewer', async () => {
    const { runReportPipeline } = await import('./pipeline')
    const seen: { stage: string; prompt: string; effort?: string }[] = []
    const run: StructuredRun = async ({ schema, prompt, effort }) => {
      const shape = (schema as { shape?: Record<string, unknown> }).shape ?? {}
      if ('coverage_note' in shape) {
        seen.push({ stage: 'analyst', prompt, effort })
        const ids = [...prompt.matchAll(/^(e\d+) \|/gm)].map((m) => m[1]!)
        return { output: schema.parse({ findings: ids.length ? [{ statement: `Finding for ${ids.join('+')}`, kind: 'problem', evidence_ids: ids }] : [], disagreement: null, requests: [], coverage_note: `${ids.length} answers` }), model: 'analyst-model' }
      }
      if ('headline' in shape) {
        seen.push({ stage: 'synthesis', prompt, effort })
        return { output: schema.parse({ headline: 'Everyone hates the prices.', themes: [{ title: 'Price', kind: 'problem', description: 'Expensive.', evidence_ids: ['e1', 'e2'] }, { title: 'Invented', kind: 'other', description: 'Made up.', evidence_ids: ['e2'] }], disagreements: [], requests: [], next_steps: [{ suggestion: 'Cut prices.', evidence_ids: ['e1'] }, { suggestion: 'Open a second branch.', evidence_ids: ['e1'] }] }), model: 'synth-model' }
      }
      seen.push({ stage: 'review', prompt, effort })
      return { output: schema.parse({ headline_supported: false, headline_rewrite: 'One person found the prices high; another found them fair.', themes: [{ index: 0, supported: true, reason: 'ok', drop_evidence_ids: ['e2'] }, { index: 1, supported: false, reason: 'not in evidence', drop_evidence_ids: [] }], disagreements: [], requests: [], next_steps: [{ index: 0, supported: true, reason: 'ok' }, { index: 1, supported: false, reason: 'unrelated' }] }), model: 'review-model' }
    }
    const pack = buildEvidencePack(db, campaignId)
    const result = await runReportPipeline(pack, run)
    const analysts = seen.filter((s) => s.stage === 'analyst')
    expect(analysts).toHaveLength(2)
    expect(analysts.every((a) => a.effort === 'low')).toBe(true)
    expect(analysts[0]?.prompt).toContain('e1 |')
    expect(analysts[0]?.prompt).toContain('e2 |')
    expect(analysts[0]?.prompt).not.toContain('e3 |')
    expect(analysts[1]?.prompt).toContain('[declined]')
    const synthesisPrompt = seen.find((s) => s.stage === 'synthesis')?.prompt ?? ''
    expect(synthesisPrompt).toContain('Finding for e1+e2')
    expect(synthesisPrompt).toContain('Finding for e3+e4')
    expect(result.output.headline).toBe('One person found the prices high; another found them fair.')
    expect(result.output.themes).toEqual([{ title: 'Price', kind: 'problem', description: 'Expensive.', evidence_ids: ['e1'] }])
    expect(result.output.next_steps.map((s) => s.suggestion)).toEqual(['Cut prices.'])
    expect(result.meta).toMatchObject({ analysts: 2, synthesisModel: 'synth-model', reviewerModel: 'review-model', review: { checked: 4, removed: 2, trimmedCitations: 1, headlineRewritten: true } })
    const stored = await generateReport(db, campaignId, run)
    expect(stored.promptVersion).toBe('report-v2-multiagent')
    expect(stored.content.pipeline?.review.removed).toBe(2)
    expect(stored.content.themes[0]?.quotes.map((q) => q.evidenceId)).toEqual(['e1'])
  })
})
