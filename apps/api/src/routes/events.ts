import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db'
import { listEvents, recordActivity } from '../services/events'
import { validationHook } from '../validation/hook'

const listQuery = z.object({ after: z.coerce.number().int().min(0).optional(), limit: z.coerce.number().int().min(1).max(200).optional() })
const activitySchema = z.object({ campaignId: z.string().min(1), type: z.string().trim().min(1).max(80), payload: z.record(z.string(), z.unknown()).optional() })

export const eventRoutes = new Hono()
  .get('/', zValidator('query', listQuery, validationHook), (c) => c.json(listEvents(db, c.req.valid('query')), 200))
  .post('/', zValidator('json', activitySchema, validationHook), (c) => c.json(recordActivity(db, c.req.valid('json')), 201))
