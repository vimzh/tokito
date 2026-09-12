import type { Hook } from '@hono/zod-validator'
import type { Env } from 'hono'

// Formats validation failures as { error: { message, issues } } like every other API error.
export const validationHook: Hook<unknown, Env, string> = (result, c) => {
  if (result.success) return
  const issues = result.error.issues.map((issue) => ({ path: issue.path.map(String), message: issue.message }))
  return c.json({ error: { message: issues[0]?.message ?? 'Invalid request.', issues } }, 400)
}
