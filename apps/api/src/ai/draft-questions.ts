import { z } from 'zod'
import { languages, questionTypes, type Campaign } from '../db/schema'
import { createStructuredRun, type StructuredRun } from './agent'

export const DRAFT_PROMPT_VERSION = 'draft-questions-v1'

export const draftOutputSchema = z.object({
  questions: z
    .array(
      z.object({
        text: z.string().describe('The question as it will be spoken on the phone.'),
        type: z.enum(questionTypes).describe('open for free answers, rating for a 1 to 5 score, choice for a short list of options.'),
        options: z.array(z.string()).describe('Answer options for choice questions. Empty for other types.'),
        required: z.boolean().describe('False for optional wrap-up or nice-to-have questions.'),
        purpose: z.string().describe('One sentence on why this question serves the goal.'),
      }),
    )
    .min(4)
    .max(8),
})

export type DraftedQuestion = z.infer<typeof draftOutputSchema>['questions'][number]
export type DraftInput = Pick<Campaign, 'goal' | 'context' | 'additionalTopics' | 'conversationMode' | 'language'>
export type DraftResult = { questions: DraftedQuestion[]; model: string; promptVersion: string }
export type Drafter = (input: DraftInput) => Promise<DraftResult>

const languageNames: Record<(typeof languages)[number], string> = { en: 'English', hi: 'Hindi' }

export const draftInstructions = `You write short phone questionnaires for Tokito, a service that calls people on behalf of an organizer to collect feedback and information.

Draft 4 to 8 questions from the organizer's goal and background. Rules:
- Write in plain spoken language that sounds natural when read aloud on a phone call. One idea per question.
- If the goal assumes an experience (tried a new menu, attended an event, used a feature), make the first question a screening question that checks whether the person actually had that experience, so people who did not are not asked as if they had.
- Never lead. Do not presume an answer, suggest a verdict, or bundle praise or criticism into the question.
- Use type "rating" (a 1 to 5 score) only when a number is genuinely useful. Use type "choice" only when the answers are a short, complete set of 2 to 6 options; put those options in "options". Otherwise use "open".
- Ask about reasons and examples where they matter to the goal, but keep the total short enough for a few minutes on the phone.
- Make the last question an open invitation for anything else the person wants to add, marked not required.
- Cover the organizer's additional topics when they are given.
- Write the questions in the requested language.`

export function buildDraftPrompt(input: DraftInput) {
  const lines = [
    `Language: ${languageNames[input.language]}`,
    `Conversation mode: ${input.conversationMode === 'dynamic' ? 'the assistant may ask follow-up questions' : 'only the prepared questions are asked, so each one must stand on its own'}`,
    `Goal: ${input.goal}`,
  ]
  if (input.context) lines.push(`Background from the organizer: ${input.context}`)
  if (input.additionalTopics) lines.push(`Additional topics to cover: ${input.additionalTopics}`)
  return lines.join('\n\n')
}

export function createDrafter(run: StructuredRun): Drafter {
  return async (input) => {
    const { output, model } = await run({ system: draftInstructions, prompt: buildDraftPrompt(input), schema: draftOutputSchema })
    const questions = output.questions.map((question) => ({
      ...question,
      text: question.text.trim(),
      options: question.type === 'choice' ? question.options.map((option) => option.trim()).filter(Boolean) : [],
    }))
    return { questions, model, promptVersion: DRAFT_PROMPT_VERSION }
  }
}

export const defaultDrafter = (): Drafter => createDrafter(createStructuredRun())
