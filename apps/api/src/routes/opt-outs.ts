import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../db'
import * as service from '../services/opt-outs'
import { validationHook } from '../validation/hook'
import { addOptOutSchema, removeOptOutSchema } from '../validation/contacts'

export const optOutRoutes = new Hono()
  .get('/', (c) => c.json(service.listOptOuts(db), 200))
  .post('/', zValidator('json', addOptOutSchema, validationHook), (c) => c.json(service.addOptOut(db, c.req.valid('json')), 201))
  .post('/remove', zValidator('json', removeOptOutSchema, validationHook), (c) => {
    service.removeOptOut(db, c.req.valid('json').phone)
    return c.body(null, 204)
  })
