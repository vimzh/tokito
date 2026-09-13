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
  defaultCountry: text('default_country').notNull().default('IN'),
}

export const workspaceSettings = sqliteTable('workspace_settings', {
  id: text('id').primaryKey(),
  ...callingPreferences,
  discordChannelId: text('discord_channel_id'),
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
  maxCalls: integer('max_calls'),
  outreachStartedAt: integer('outreach_started_at'),
  outreachPausedAt: integer('outreach_paused_at'),
  outreachStoppedAt: integer('outreach_stopped_at'),
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

export const contactStatuses = ['ready', 'invalid', 'duplicate', 'opted_out', 'excluded'] as const
export const contactProblems = ['missing_phone', 'invalid_phone', 'duplicate_in_file', 'duplicate_existing', 'opted_out'] as const
export type ContactStatus = (typeof contactStatuses)[number]
export type ContactProblem = (typeof contactProblems)[number]

export const contactImports = sqliteTable('contact_imports', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  headers: text('headers', { mode: 'json' }).$type<string[]>().notNull(),
  rows: text('rows', { mode: 'json' }).$type<string[][]>().notNull(),
  mapping: text('mapping', { mode: 'json' }).$type<{ nameColumn: number | null; phoneColumn: number; contextColumns: number[] }>(),
  committedAt: integer('committed_at'),
  createdAt: integer('created_at').notNull(),
})

export const contacts = sqliteTable(
  'contacts',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    importId: text('import_id').references(() => contactImports.id, { onDelete: 'set null' }),
    name: text('name'),
    phoneRaw: text('phone_raw').notNull(),
    phone: text('phone'),
    status: text('status', { enum: contactStatuses }).notNull(),
    problem: text('problem', { enum: contactProblems }),
    context: text('context', { mode: 'json' }).$type<Record<string, string>>().notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [index('contacts_campaign').on(table.campaignId), index('contacts_phone').on(table.phone)],
)

export const optOuts = sqliteTable('opt_outs', {
  phone: text('phone').primaryKey(),
  reason: text('reason'),
  createdAt: integer('created_at').notNull(),
})

export const callStatuses = ['queued', 'dialing', 'in_progress', 'completed', 'no_answer', 'busy', 'failed', 'declined', 'callback_requested', 'opted_out', 'canceled'] as const
export const callProviders = ['calle', 'simulator'] as const
export const answerStatuses = ['answered', 'skipped', 'declined', 'unknown', 'not_asked'] as const
export const callSpeakers = ['assistant', 'person', 'unknown'] as const
export type CallStatus = (typeof callStatuses)[number]
export type AnswerStatus = (typeof answerStatuses)[number]

export const calls = sqliteTable(
  'calls',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    contactId: text('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    personName: text('person_name'),
    provider: text('provider', { enum: callProviders }).notNull(),
    providerCallId: text('provider_call_id'),
    providerRecipientId: text('provider_recipient_id'),
    providerAttemptId: text('provider_attempt_id'),
    idempotencyKey: text('idempotency_key'),
    scheduledAt: integer('scheduled_at'),
    lastPolledAt: integer('last_polled_at'),
    calendarEventId: text('calendar_event_id'),
    attempt: integer('attempt').notNull().default(1),
    status: text('status', { enum: callStatuses }).notNull(),
    task: text('task').notNull(),
    resultSchema: text('result_schema', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    questionMap: text('question_map', { mode: 'json' }).$type<Record<string, string>>().notNull(),
    summary: text('summary'),
    structuredResult: text('structured_result', { mode: 'json' }).$type<Record<string, unknown>>(),
    requestsForOrganizer: text('requests_for_organizer'),
    callbackRequested: integer('callback_requested', { mode: 'boolean' }).notNull().default(false),
    callbackTime: text('callback_time'),
    optOut: integer('opt_out', { mode: 'boolean' }).notNull().default(false),
    failureCode: text('failure_code'),
    failureMessage: text('failure_message'),
    startedAt: integer('started_at'),
    endedAt: integer('ended_at'),
    durationSeconds: integer('duration_seconds'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [index('calls_campaign').on(table.campaignId), index('calls_contact').on(table.contactId)],
)

export const callTurns = sqliteTable(
  'call_turns',
  {
    id: text('id').primaryKey(),
    callId: text('call_id')
      .notNull()
      .references(() => calls.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    speaker: text('speaker', { enum: callSpeakers }).notNull(),
    text: text('text').notNull(),
    offsetSeconds: integer('offset_seconds'),
  },
  (table) => [uniqueIndex('call_turns_call_position').on(table.callId, table.position)],
)

export const answers = sqliteTable(
  'answers',
  {
    id: text('id').primaryKey(),
    callId: text('call_id')
      .notNull()
      .references(() => calls.id, { onDelete: 'cascade' }),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    contactId: text('contact_id'),
    questionId: text('question_id').notNull(),
    questionText: text('question_text').notNull(),
    status: text('status', { enum: answerStatuses }).notNull(),
    value: text('value'),
    valueNumber: integer('value_number'),
    notes: text('notes'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('answers_campaign').on(table.campaignId), index('answers_call').on(table.callId), index('answers_question').on(table.questionId)],
)

export const providerEvents = sqliteTable('provider_events', {
  id: text('id').primaryKey(),
  provider: text('provider', { enum: callProviders }).notNull(),
  type: text('type').notNull(),
  callId: text('call_id'),
  payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  receivedAt: integer('received_at').notNull(),
  processedAt: integer('processed_at'),
  error: text('error'),
})

export const reports = sqliteTable(
  'reports',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    model: text('model').notNull(),
    promptVersion: text('prompt_version').notNull(),
    content: text('content', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    externalUrl: text('external_url'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [uniqueIndex('reports_campaign_version').on(table.campaignId, table.version)],
)

export const reportQuestions = sqliteTable(
  'report_questions',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    answer: text('answer', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    model: text('model').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('report_questions_campaign').on(table.campaignId)],
)

export const connectionProviders = ['google', 'notion'] as const
export const campaignConnectionKinds = ['sheets', 'calendar', 'notion'] as const
export type ConnectionProvider = (typeof connectionProviders)[number]
export type CampaignConnectionKind = (typeof campaignConnectionKinds)[number]

export const connections = sqliteTable('connections', {
  provider: text('provider', { enum: connectionProviders }).primaryKey(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  expiresAt: integer('expires_at'),
  scope: text('scope'),
  accountLabel: text('account_label'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const campaignConnections = sqliteTable(
  'campaign_connections',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: campaignConnectionKinds }).notNull(),
    config: text('config', { mode: 'json' }).$type<Record<string, string>>().notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    lastSyncAt: integer('last_sync_at'),
    lastStatus: text('last_status', { enum: ['ok', 'failed'] }),
    lastError: text('last_error'),
    lastExternalUrl: text('last_external_url'),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [uniqueIndex('campaign_connections_campaign_kind').on(table.campaignId, table.kind)],
)

export type Campaign = typeof campaigns.$inferSelect
export type Question = typeof questions.$inferSelect
export type CampaignEvent = typeof campaignEvents.$inferSelect
export type WorkspaceSettings = typeof workspaceSettings.$inferSelect
export type Contact = typeof contacts.$inferSelect
export type ContactImport = typeof contactImports.$inferSelect
export type OptOut = typeof optOuts.$inferSelect
export type Call = typeof calls.$inferSelect
export type CallTurn = typeof callTurns.$inferSelect
export type Answer = typeof answers.$inferSelect
export type Report = typeof reports.$inferSelect
export type ReportQuestion = typeof reportQuestions.$inferSelect
export type Connection = typeof connections.$inferSelect
export type CampaignConnection = typeof campaignConnections.$inferSelect
