import { z } from 'zod'
import { conversationModes, questionSources } from '../db/schema'

const trimmed = (max: number) => z.string().trim().min(1).max(max)

export const questionTextSchema = trimmed(500)

export const createCampaignSchema = z
  .object({
    name: trimmed(120),
    goal: trimmed(2000),
    context: z.string().trim().max(4000).optional(),
    additionalTopics: z.string().trim().max(2000).optional(),
    questionSource: z.enum(questionSources),
    conversationMode: z.enum(conversationModes),
    questions: z.array(questionTextSchema).max(50).optional(),
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
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update.' })

export const replaceQuestionsSchema = z.object({
  questions: z.array(questionTextSchema).max(50),
})

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>
export type ReplaceQuestionsInput = z.infer<typeof replaceQuestionsSchema>
