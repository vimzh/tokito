import { describe, expect, test, beforeEach } from 'bun:test'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { createDb, type Db } from '../db'
import { campaignEvents, questions } from '../db/schema'
import { createCampaignSchema, type CreateCampaignInput } from '../validation/campaigns'
import { NotFoundError, createCampaign, deleteCampaign, getCampaign, listCampaigns, replaceQuestions, updateCampaign } from './campaigns'

let db: Db

beforeEach(() => {
  db = createDb(':memory:')
  migrate(db, { migrationsFolder: './drizzle' })
})

const manual: CreateCampaignInput = {
  name: 'Menu feedback',
  goal: 'Learn what customers think of the new menu.',
  questionSource: 'manual',
  conversationMode: 'dynamic',
  questions: ['Which dishes did you try?', 'What would you change?'],
}

describe('campaigns service', () => {
  test('creates a draft with ordered questions and an event', () => {
    const campaign = createCampaign(db, manual)
    expect(campaign.status).toBe('draft')
    expect(campaign.questions.map((q) => q.text)).toEqual(manual.questions ?? [])
    expect(campaign.questions.map((q) => q.position)).toEqual([0, 1])
    expect(db.select().from(campaignEvents).all()).toHaveLength(1)
    expect(listCampaigns(db)[0]?.questionCount).toBe(2)
  })

  test('AI source stores no questions yet', () => {
    const campaign = createCampaign(db, { ...manual, questionSource: 'ai', questions: undefined })
    expect(campaign.questions).toHaveLength(0)
  })

  test('validation rejects manual source without questions', () => {
    const result = createCampaignSchema.safeParse({ ...manual, questions: [] })
    expect(result.success).toBe(false)
    expect(createCampaignSchema.safeParse({}).success).toBe(false)
  })

  test('updates fields and replaces questions', () => {
    const { id } = createCampaign(db, manual)
    expect(updateCampaign(db, id, { goal: 'New goal' }).goal).toBe('New goal')
    const updated = replaceQuestions(db, id, { questions: ['Only one'] })
    expect(updated.questions.map((q) => q.text)).toEqual(['Only one'])
  })

  test('unknown ids raise NotFoundError', () => {
    expect(() => getCampaign(db, 'nope')).toThrow(NotFoundError)
    expect(() => updateCampaign(db, 'nope', { name: 'x' })).toThrow(NotFoundError)
    expect(() => deleteCampaign(db, 'nope')).toThrow(NotFoundError)
  })

  test('delete cascades to questions and events', () => {
    const { id } = createCampaign(db, manual)
    deleteCampaign(db, id)
    expect(listCampaigns(db)).toHaveLength(0)
    expect(db.select().from(questions).all()).toHaveLength(0)
    expect(db.select().from(campaignEvents).all()).toHaveLength(0)
  })
})
