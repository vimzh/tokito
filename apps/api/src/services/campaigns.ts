import { asc, count, desc, eq } from 'drizzle-orm'
import type { Db } from '../db'
import { campaignEvents, campaigns, questions } from '../db/schema'
import type { CreateCampaignInput, QuestionInput, ReplaceQuestionsInput, UpdateCampaignInput } from '../validation/campaigns'
import { getSettings } from './settings'

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

export class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message)
    this.name = 'NotFoundError'
  }
}

const id = () => crypto.randomUUID()

function recordEvent(tx: Db | Tx, campaignId: string, type: string, payload?: Record<string, unknown>) {
  tx.insert(campaignEvents).values({ id: id(), campaignId, type, payload, createdAt: Date.now() }).run()
}

function insertQuestions(tx: Db | Tx, campaignId: string, items: QuestionInput[]) {
  if (items.length === 0) return
  tx.insert(questions)
    .values(
      items.map((item, position) => ({
        id: id(),
        campaignId,
        position,
        text: item.text,
        type: item.type,
        options: item.type === 'choice' ? item.options : null,
        required: item.required,
        source: item.source,
      })),
    )
    .run()
}

export function listCampaigns(db: Db) {
  return db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      goal: campaigns.goal,
      status: campaigns.status,
      questionSource: campaigns.questionSource,
      conversationMode: campaigns.conversationMode,
      createdAt: campaigns.createdAt,
      updatedAt: campaigns.updatedAt,
      questionCount: count(questions.id),
    })
    .from(campaigns)
    .leftJoin(questions, eq(questions.campaignId, campaigns.id))
    .groupBy(campaigns.id)
    .orderBy(desc(campaigns.updatedAt))
    .all()
}

export function getCampaign(db: Db, campaignId: string) {
  const campaign = db.select().from(campaigns).where(eq(campaigns.id, campaignId)).get()
  if (!campaign) throw new NotFoundError('Campaign not found')
  const rows = db.select().from(questions).where(eq(questions.campaignId, campaignId)).orderBy(asc(questions.position)).all()
  return { ...campaign, questions: rows }
}

export function createCampaign(db: Db, input: CreateCampaignInput) {
  const now = Date.now()
  const campaignId = id()
  const { language, maxCallMinutes, callingHoursStart, callingHoursEnd, timezone, maxAttempts } = getSettings(db)
  db.transaction((tx) => {
    tx.insert(campaigns)
      .values({
        id: campaignId,
        name: input.name,
        goal: input.goal,
        context: input.context || null,
        additionalTopics: input.additionalTopics || null,
        questionSource: input.questionSource,
        conversationMode: input.conversationMode,
        language,
        maxCallMinutes,
        callingHoursStart,
        callingHoursEnd,
        timezone,
        maxAttempts,
        createdAt: now,
        updatedAt: now,
      })
      .run()
    const manualQuestions = input.questionSource === 'manual' ? (input.questions ?? []) : []
    insertQuestions(
      tx,
      campaignId,
      manualQuestions.map((text) => ({ text, type: 'open', options: [], required: true, source: 'manual' })),
    )
    recordEvent(tx, campaignId, 'campaign.created', { questionSource: input.questionSource })
  })
  return getCampaign(db, campaignId)
}

export function updateCampaign(db: Db, campaignId: string, input: UpdateCampaignInput) {
  getCampaign(db, campaignId)
  db.transaction((tx) => {
    tx.update(campaigns)
      .set({ ...input, updatedAt: Date.now() })
      .where(eq(campaigns.id, campaignId))
      .run()
    recordEvent(tx, campaignId, 'campaign.updated', { fields: Object.keys(input) })
  })
  return getCampaign(db, campaignId)
}

export function replaceQuestions(db: Db, campaignId: string, input: ReplaceQuestionsInput) {
  getCampaign(db, campaignId)
  db.transaction((tx) => {
    tx.delete(questions).where(eq(questions.campaignId, campaignId)).run()
    insertQuestions(tx, campaignId, input.questions)
    tx.update(campaigns)
      .set({
        updatedAt: Date.now(),
        ...(input.draft ? { lastDraftModel: input.draft.model, lastDraftPromptVersion: input.draft.promptVersion } : {}),
      })
      .where(eq(campaigns.id, campaignId))
      .run()
    recordEvent(tx, campaignId, 'questions.replaced', { count: input.questions.length, draft: input.draft ?? null })
  })
  return getCampaign(db, campaignId)
}

export function recordDraft(db: Db, campaignId: string, payload: Record<string, unknown>) {
  recordEvent(db, campaignId, 'questions.drafted', payload)
}

export function deleteCampaign(db: Db, campaignId: string) {
  getCampaign(db, campaignId)
  db.delete(campaigns).where(eq(campaigns.id, campaignId)).run()
}
