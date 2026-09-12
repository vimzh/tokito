import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db'
import { createStructuredRun } from '../ai/agent'
import * as simulator from '../calls/simulator'
import { campaignResults } from '../calls/results'
import { buildExportFile } from '../calls/export'
import { validationHook } from '../validation/hook'

const previewQuerySchema = z.object({ contactId: z.string().optional() })
const exportQuerySchema = z.object({ kind: z.enum(['answers', 'calls']).default('answers'), format: z.enum(['csv', 'xlsx']).default('csv') })
const startSchema = z.object({ contactId: z.string().optional(), personName: z.string().trim().max(120).optional() })
const turnSchema = z.object({ text: z.string().trim().min(1).max(2000) })

// Mounted under /api/campaigns; full paths keep the :id param typed.
export const callRoutes = new Hono()
  .get('/:id/task-preview', zValidator('query', previewQuerySchema, validationHook), (c) =>
    c.json(simulator.previewTask(db, c.req.param('id'), c.req.valid('query').contactId || undefined), 200),
  )
  .get('/:id/calls', (c) => c.json(simulator.listCalls(db, c.req.param('id')), 200))
  .get('/:id/results', (c) => c.json(campaignResults(db, c.req.param('id')), 200))
  .get('/:id/export', zValidator('query', exportQuerySchema, validationHook), (c) => {
    const { kind, format } = c.req.valid('query')
    const file = buildExportFile(db, c.req.param('id'), kind, format)
    return c.body(file.body, 200, { 'Content-Type': file.contentType, 'Content-Disposition': `attachment; filename="${file.fileName}"` })
  })
  .get('/:id/calls/:callId', (c) => c.json(simulator.getCall(db, c.req.param('id'), c.req.param('callId')), 200))
  .post('/:id/simulations', zValidator('json', startSchema, validationHook), async (c) =>
    c.json(await simulator.startSimulation(db, c.req.param('id'), c.req.valid('json'), createStructuredRun()), 201),
  )
  .post('/:id/simulations/:callId/turns', zValidator('json', turnSchema, validationHook), async (c) =>
    c.json(await simulator.simulationTurn(db, c.req.param('id'), c.req.param('callId'), c.req.valid('json').text, createStructuredRun()), 200),
  )
