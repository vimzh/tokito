import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db'
import { createStructuredRun } from '../ai/agent'
import { generateReport, getReport } from '../reports/generate'
import { askReport, listReportQuestions } from '../reports/ask'
import { validationHook } from '../validation/hook'

const versionQuery = z.object({ version: z.coerce.number().int().min(1).optional() })
const askSchema = z.object({ question: z.string().trim().min(3).max(500) })

// Mounted under /api/campaigns; full paths keep the :id param typed.
export const reportRoutes = new Hono()
  .get('/:id/report', zValidator('query', versionQuery, validationHook), (c) => c.json(getReport(db, c.req.param('id'), c.req.valid('query').version), 200))
  .post('/:id/report', async (c) => c.json(await generateReport(db, c.req.param('id'), createStructuredRun()), 201))
  .get('/:id/report/questions', (c) => c.json(listReportQuestions(db, c.req.param('id')), 200))
  .post('/:id/report/ask', zValidator('json', askSchema, validationHook), async (c) =>
    c.json(await askReport(db, c.req.param('id'), c.req.valid('json').question, createStructuredRun()), 201),
  )
