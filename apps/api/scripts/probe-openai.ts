// Quick check that the OpenAI account accepts requests, with the cheapest and the default model.
import { z } from 'zod'
import { createStructuredRun } from '../src/ai/agent'
import { aiConfig } from '../src/ai/config'
for (const model of ['gpt-5.4-nano', aiConfig.model]) {
  aiConfig.model = model
  const started = Date.now()
  try {
    const r = await createStructuredRun()({ system: 'Reply with the single word ok.', prompt: 'ping', schema: z.object({ word: z.string() }), effort: 'low' })
    console.log(model, 'OK', JSON.stringify(r.output), `${Date.now() - started}ms`)
  } catch (e) {
    console.log(model, 'FAILED:', e instanceof Error ? e.message.slice(0, 200) : e)
  }
}
