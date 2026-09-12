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
    const updated = replaceQuestions(db, id, { questions: [{ text: 'Only one', type: 'open', options: [], required: true, source: 'manual' }] })
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

describe('phase 2: settings and typed questions', () => {
  test('new campaigns copy workspace defaults', async () => {
    const { updateSettings } = await import('./settings')
    updateSettings(db, { language: 'hi', maxCallMinutes: 3, timezone: 'Europe/London' })
    const campaign = createCampaign(db, manual)
    expect(campaign).toMatchObject({ language: 'hi', maxCallMinutes: 3, timezone: 'Europe/London', maxAttempts: 2, clarificationsAllowed: true })
  })

  test('stores typed questions with options and draft metadata', () => {
    const { id } = createCampaign(db, manual)
    const updated = replaceQuestions(db, id, {
      questions: [
        { text: 'Tried it?', type: 'choice', options: ['Yes', 'No'], required: true, source: 'ai' },
        { text: 'Score?', type: 'rating', options: [], required: false, source: 'ai' },
      ],
      draft: { model: 'gpt-test', promptVersion: 'v1' },
    })
    expect(updated.questions[0]).toMatchObject({ type: 'choice', options: ['Yes', 'No'], source: 'ai' })
    expect(updated.questions[1]).toMatchObject({ type: 'rating', options: null, required: false })
    expect(updated.lastDraftModel).toBe('gpt-test')
  })

  test('validation guards question options and calling hours', async () => {
    const { questionInputSchema, updateCampaignSchema } = await import('../validation/campaigns')
    expect(questionInputSchema.safeParse({ text: 'Pick', type: 'choice', options: ['A'] }).success).toBe(false)
    expect(questionInputSchema.safeParse({ text: 'Pick', type: 'choice', options: ['A', 'a'] }).success).toBe(false)
    expect(questionInputSchema.safeParse({ text: 'Open', type: 'open', options: ['A'] }).success).toBe(false)
    expect(questionInputSchema.safeParse({ text: 'Open' }).success).toBe(true)
    expect(updateCampaignSchema.safeParse({ callingHoursStart: '18:00', callingHoursEnd: '09:00' }).success).toBe(false)
    expect(updateCampaignSchema.safeParse({ timezone: 'Mars/Olympus' }).success).toBe(false)
    expect(updateCampaignSchema.safeParse({ timezone: 'Asia/Kolkata', maxCallMinutes: 10 }).success).toBe(true)
  })
})
