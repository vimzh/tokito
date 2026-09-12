import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../db'
import * as service from '../services/campaigns'
import { createCampaignSchema, replaceQuestionsSchema, updateCampaignSchema } from '../validation/campaigns'

export const campaignRoutes = new Hono()
  .get('/', (c) => c.json(service.listCampaigns(db)))
  .post('/', zValidator('json', createCampaignSchema), (c) => c.json(service.createCampaign(db, c.req.valid('json')), 201))
  .get('/:id', (c) => c.json(service.getCampaign(db, c.req.param('id'))))
  .patch('/:id', zValidator('json', updateCampaignSchema), (c) =>
    c.json(service.updateCampaign(db, c.req.param('id'), c.req.valid('json'))),
  )
  .put('/:id/questions', zValidator('json', replaceQuestionsSchema), (c) =>
    c.json(service.replaceQuestions(db, c.req.param('id'), c.req.valid('json'))),
  )
  .delete('/:id', (c) => {
    service.deleteCampaign(db, c.req.param('id'))
    return c.body(null, 204)
  })
