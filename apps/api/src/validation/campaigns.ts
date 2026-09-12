import { z } from 'zod'
import { isSupportedCountry } from 'libphonenumber-js'
import { conversationModes, languages, questionSources, questionTypes } from '../db/schema'

const trimmed = (max: number) => z.string().trim().min(1).max(max)
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM, for example 09:30.')

// Intl accepts aliases such as Asia/Kolkata that supportedValuesOf() may list under another name.
function isTimezone(value: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value })
    return true
  } catch {
    return false
  }
}

export const callingPreferencesSchema = z.object({
  language: z.enum(languages),
  maxCallMinutes: z.number().int().min(1).max(20),
  callingHoursStart: clockTime,
  callingHoursEnd: clockTime,
  timezone: z.string().refine(isTimezone, 'Unknown time zone.'),
  maxAttempts: z.number().int().min(1).max(5),
  defaultCountry: z.string().length(2).toUpperCase().refine((value) => isSupportedCountry(value), 'Unknown country code.'),
})

const hoursInOrder = (data: { callingHoursStart?: string; callingHoursEnd?: string }) =>
  !data.callingHoursStart || !data.callingHoursEnd || data.callingHoursEnd > data.callingHoursStart
const hoursMessage = { message: 'Calling hours must end after they start.', path: ['callingHoursEnd'] }

export const questionInputSchema = z
  .object({
    text: trimmed(500),
    type: z.enum(questionTypes).default('open'),
    options: z.array(trimmed(120)).max(8).default([]),
    required: z.boolean().default(true),
    source: z.enum(questionSources).default('manual'),
  })
  .superRefine((question, ctx) => {
    if (question.type === 'choice') {
      if (question.options.length < 2) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Choice questions need at least two options.' })
      if (new Set(question.options.map((option) => option.toLowerCase())).size !== question.options.length)
        ctx.addIssue({ code: 'custom', path: ['options'], message: 'Options must be different from each other.' })
    } else if (question.options.length > 0) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Only choice questions can have options.' })
    }
  })

export const createCampaignSchema = z
  .object({
    name: trimmed(120),
    goal: trimmed(2000),
    context: z.string().trim().max(4000).optional(),
    additionalTopics: z.string().trim().max(2000).optional(),
    questionSource: z.enum(questionSources),
    conversationMode: z.enum(conversationModes),
    questions: z.array(trimmed(500)).max(50).optional(),
  })
  .refine((data) => data.questionSource !== 'manual' || (data.questions?.length ?? 0) > 0, {
    message: 'Add at least one question when writing your own.',
    path: ['questions'],
  })

export const updateCampaignSchema = z
  .object({
    name: trimmed(120).optional(),
    goal: trimmed(2000).optional(),
    context: z.string().trim().max(4000).nullable().optional(),
    additionalTopics: z.string().trim().max(2000).nullable().optional(),
    conversationMode: z.enum(conversationModes).optional(),
    clarificationsAllowed: z.boolean().optional(),
    maxCalls: z.number().int().min(1).max(100000).nullable().optional(),
  })
  .extend(callingPreferencesSchema.partial().shape)
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update.' })
  .refine(hoursInOrder, hoursMessage)

export const replaceQuestionsSchema = z.object({
  questions: z.array(questionInputSchema).max(50),
  draft: z.object({ model: z.string().max(100), promptVersion: z.string().max(100) }).optional(),
})

export const updateSettingsSchema = callingPreferencesSchema.partial().extend({ discordChannelId: z.string().trim().max(64).nullable().optional() }).refine(hoursInOrder, hoursMessage)

export type QuestionInput = z.infer<typeof questionInputSchema>
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>
export type ReplaceQuestionsInput = z.infer<typeof replaceQuestionsSchema>
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>
