import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core'

export const campaignStatuses = ['draft', 'ready', 'running', 'paused', 'completed'] as const
export const questionSources = ['ai', 'manual'] as const
export const conversationModes = ['dynamic', 'fixed'] as const
export const questionTypes = ['open', 'rating', 'choice'] as const

export type CampaignStatus = (typeof campaignStatuses)[number]
export type QuestionSource = (typeof questionSources)[number]
export type ConversationMode = (typeof conversationModes)[number]
export type QuestionType = (typeof questionTypes)[number]

export const campaigns = sqliteTable('campaigns', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  goal: text('goal').notNull(),
  context: text('context'),
  additionalTopics: text('additional_topics'),
  questionSource: text('question_source', { enum: questionSources }).notNull(),
  conversationMode: text('conversation_mode', { enum: conversationModes }).notNull(),
  status: text('status', { enum: campaignStatuses }).notNull().default('draft'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const questions = sqliteTable(
  'questions',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    text: text('text').notNull(),
    type: text('type', { enum: questionTypes }).notNull().default('open'),
    options: text('options', { mode: 'json' }).$type<string[]>(),
    required: integer('required', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => [uniqueIndex('questions_campaign_position').on(table.campaignId, table.position)],
)

export const campaignEvents = sqliteTable(
  'campaign_events',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('campaign_events_campaign').on(table.campaignId)],
)

export type Campaign = typeof campaigns.$inferSelect
export type Question = typeof questions.$inferSelect
export type CampaignEvent = typeof campaignEvents.$inferSelect
