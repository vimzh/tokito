import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../db'
import * as service from '../services/settings'
import { validationHook } from '../validation/hook'
import { updateSettingsSchema } from '../validation/campaigns'

export const settingsRoutes = new Hono()
  .get('/', (c) => c.json(service.getSettings(db)))
  .put('/', zValidator('json', updateSettingsSchema, validationHook), (c) => c.json(service.updateSettings(db, c.req.valid('json'))))
