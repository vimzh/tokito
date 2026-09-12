import { asc, count, desc, eq } from 'drizzle-orm'
import type { Db } from '../db'
import { campaignEvents, campaigns, questions } from '../db/schema'
import type { CreateCampaignInput, ReplaceQuestionsInput, UpdateCampaignInput } from '../validation/campaigns'

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

function insertQuestions(tx: Db | Tx, campaignId: string, texts: string[]) {
  if (texts.length === 0) return
  tx.insert(questions)
    .values(texts.map((text, position) => ({ id: id(), campaignId, position, text })))
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
        createdAt: now,
        updatedAt: now,
      })
      .run()
    insertQuestions(tx, campaignId, input.questionSource === 'manual' ? (input.questions ?? []) : [])
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
    tx.update(campaigns).set({ updatedAt: Date.now() }).where(eq(campaigns.id, campaignId)).run()
    recordEvent(tx, campaignId, 'questions.replaced', { count: input.questions.length })
  })
  return getCampaign(db, campaignId)
}

export function deleteCampaign(db: Db, campaignId: string) {
  getCampaign(db, campaignId)
  db.delete(campaigns).where(eq(campaigns.id, campaignId)).run()
}
