import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db'
import { createStructuredRun } from '../ai/agent'
import * as simulator from '../calls/simulator'
import { validationHook } from '../validation/hook'

const previewQuerySchema = z.object({ contactId: z.string().optional() })
const startSchema = z.object({ contactId: z.string().optional(), personName: z.string().trim().max(120).optional() })
const turnSchema = z.object({ text: z.string().trim().min(1).max(2000) })

// Mounted under /api/campaigns; full paths keep the :id param typed.
export const callRoutes = new Hono()
  .get('/:id/task-preview', zValidator('query', previewQuerySchema, validationHook), (c) =>
    c.json(simulator.previewTask(db, c.req.param('id'), c.req.valid('query').contactId || undefined), 200),
  )
  .get('/:id/calls', (c) => c.json(simulator.listCalls(db, c.req.param('id')), 200))
  .get('/:id/calls/:callId', (c) => c.json(simulator.getCall(db, c.req.param('id'), c.req.param('callId')), 200))
  .post('/:id/simulations', zValidator('json', startSchema, validationHook), async (c) =>
    c.json(await simulator.startSimulation(db, c.req.param('id'), c.req.valid('json'), createStructuredRun()), 201),
  )
  .post('/:id/simulations/:callId/turns', zValidator('json', turnSchema, validationHook), async (c) =>
    c.json(await simulator.simulationTurn(db, c.req.param('id'), c.req.param('callId'), c.req.valid('json').text, createStructuredRun()), 200),
  )
