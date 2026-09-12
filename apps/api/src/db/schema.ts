import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core'

export const campaignStatuses = ['draft', 'ready', 'running', 'paused', 'completed'] as const
export const questionSources = ['ai', 'manual'] as const
export const conversationModes = ['dynamic', 'fixed'] as const
export const questionTypes = ['open', 'rating', 'choice'] as const
export const languages = ['en', 'hi'] as const

export type CampaignStatus = (typeof campaignStatuses)[number]
export type QuestionSource = (typeof questionSources)[number]
export type ConversationMode = (typeof conversationModes)[number]
export type QuestionType = (typeof questionTypes)[number]
export type Language = (typeof languages)[number]

// Calling preferences shared by workspace defaults and each campaign.
const callingPreferences = {
  language: text('language', { enum: languages }).notNull().default('en'),
  maxCallMinutes: integer('max_call_minutes').notNull().default(5),
  callingHoursStart: text('calling_hours_start').notNull().default('10:00'),
  callingHoursEnd: text('calling_hours_end').notNull().default('18:00'),
  timezone: text('timezone').notNull().default('Asia/Kolkata'),
  maxAttempts: integer('max_attempts').notNull().default(2),
}

export const workspaceSettings = sqliteTable('workspace_settings', {
  id: text('id').primaryKey(),
  ...callingPreferences,
  updatedAt: integer('updated_at').notNull(),
})

export const campaigns = sqliteTable('campaigns', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  goal: text('goal').notNull(),
  context: text('context'),
  additionalTopics: text('additional_topics'),
  questionSource: text('question_source', { enum: questionSources }).notNull(),
  conversationMode: text('conversation_mode', { enum: conversationModes }).notNull(),
  status: text('status', { enum: campaignStatuses }).notNull().default('draft'),
  ...callingPreferences,
  clarificationsAllowed: integer('clarifications_allowed', { mode: 'boolean' }).notNull().default(true),
  lastDraftModel: text('last_draft_model'),
  lastDraftPromptVersion: text('last_draft_prompt_version'),
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
    source: text('source', { enum: questionSources }).notNull().default('manual'),
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
export type WorkspaceSettings = typeof workspaceSettings.$inferSelect
