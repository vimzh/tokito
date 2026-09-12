import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../db'
import * as service from '../services/campaigns'
import { defaultDrafter } from '../ai/draft-questions'
import { contactRoutes } from './contacts'
import { callRoutes } from './calls'
import { outreachRoutes } from './outreach'
import { validationHook } from '../validation/hook'
import { createCampaignSchema, replaceQuestionsSchema, updateCampaignSchema } from '../validation/campaigns'

export const campaignRoutes = new Hono()
  .get('/', (c) => c.json(service.listCampaigns(db)))
  .post('/', zValidator('json', createCampaignSchema, validationHook), (c) => c.json(service.createCampaign(db, c.req.valid('json')), 201))
  .get('/:id', (c) => c.json(service.getCampaign(db, c.req.param('id'))))
  .patch('/:id', zValidator('json', updateCampaignSchema, validationHook), (c) =>
    c.json(service.updateCampaign(db, c.req.param('id'), c.req.valid('json')), 200),
  )
  .put('/:id/questions', zValidator('json', replaceQuestionsSchema, validationHook), (c) =>
    c.json(service.replaceQuestions(db, c.req.param('id'), c.req.valid('json')), 200),
  )
  .post('/:id/questions/draft', async (c) => {
    const campaign = service.getCampaign(db, c.req.param('id'))
    const draft = await defaultDrafter()(campaign)
    service.recordDraft(db, campaign.id, { model: draft.model, promptVersion: draft.promptVersion, count: draft.questions.length })
    return c.json(draft)
  })
  .delete('/:id', (c) => {
    service.deleteCampaign(db, c.req.param('id'))
    return c.body(null, 204)
  })
  .route('/', contactRoutes)
  .route('/', callRoutes)
  .route('/', outreachRoutes)
