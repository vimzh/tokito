import { describe, expect, test } from 'bun:test'
import { buildDraftPrompt, createDrafter, DRAFT_PROMPT_VERSION, type DraftInput } from './draft-questions'
import type { StructuredRun } from './agent'

const input: DraftInput = {
  goal: 'We changed our menu. Find out what customers think of the dishes, choices, and prices.',
  context: 'Family restaurant in Pune. New menu launched last month.',
  additionalTopics: 'portion sizes',
  conversationMode: 'dynamic',
  language: 'en',
}

const output = {
  questions: [
    { text: ' Have you tried the new menu? ', type: 'choice', options: [' Yes ', 'No', ''], required: true, purpose: 'Screening.' },
    { text: 'What did you think of the prices?', type: 'open', options: ['stray'], required: true, purpose: 'Value.' },
    { text: 'How would you rate the portion sizes from 1 to 5?', type: 'rating', options: [], required: true, purpose: 'Portions.' },
    { text: 'Anything else?', type: 'open', options: [], required: false, purpose: 'Wrap-up.' },
  ],
}

describe('draft prompt', () => {
  test('includes goal, background, topics, mode, and language', () => {
    const prompt = buildDraftPrompt(input)
    expect(prompt).toContain(input.goal)
    expect(prompt).toContain('Family restaurant in Pune')
    expect(prompt).toContain('portion sizes')
    expect(prompt).toContain('follow-up')
    expect(prompt).toContain('English')
  })
})

describe('drafter', () => {
  test('sends the instructions and schema, then normalizes the questions', async () => {
    const calls: unknown[] = []
    const run: StructuredRun = async (args) => {
      calls.push(args)
      return { output: args.schema.parse(output), model: 'gpt-test' }
    }
    const result = await createDrafter(run)(input)
    expect(calls).toHaveLength(1)
    expect((calls[0] as { system: string }).system).toContain('screening question')
    expect(result.model).toBe('gpt-test')
    expect(result.promptVersion).toBe(DRAFT_PROMPT_VERSION)
    expect(result.questions[0]).toMatchObject({ text: 'Have you tried the new menu?', options: ['Yes', 'No'] })
    expect(result.questions[1]?.options).toEqual([])
    expect(result.questions.map((q) => q.required)).toEqual([true, true, true, false])
  })

  test('propagates failures from the run', async () => {
    const run: StructuredRun = async () => { throw new Error('boom') }
    await expect(createDrafter(run)(input)).rejects.toThrow('boom')
  })
})
