import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db'
import * as scheduler from '../calls/scheduler'
import { calleConfig, defaultProvider, providerConfigured } from '../calls/provider'
import { validationHook } from '../validation/hook'

const callbackSchema = z.object({ at: z.string().datetime({ offset: true }) })

// Mounted under /api/campaigns; full paths keep the :id param typed.
export const outreachRoutes = new Hono()
  .get('/:id/outreach', (c) => c.json(scheduler.outreachStatus(db, c.req.param('id'), { providerConfigured: providerConfigured() }), 200))
  .post('/:id/outreach/start', (c) => c.json(scheduler.startOutreach(db, c.req.param('id'), providerConfigured()), 200))
  .post('/:id/outreach/pause', (c) => c.json(scheduler.pauseOutreach(db, c.req.param('id')), 200))
  .post('/:id/outreach/stop', (c) => c.json(scheduler.stopOutreach(db, c.req.param('id')), 200))
  .post('/:id/calls/:callId/callback', zValidator('json', callbackSchema, validationHook), (c) =>
    c.json(scheduler.scheduleCallback(db, c.req.param('id'), c.req.param('callId'), Date.parse(c.req.valid('json').at)), 201),
  )

const webhookSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  data: z.object({ id: z.string().min(1), status: z.enum(['queued', 'in_progress', 'completed', 'failed', 'canceled']), summary: z.string().nullable().optional(), recipients: z.array(z.any()).default([]) }).passthrough(),
})

export const webhookRoutes = new Hono().post('/calle', zValidator('json', webhookSchema, validationHook), (c) => {
  const body = c.req.valid('json')
  const eventId = c.req.header('CALL-E-Event-Id') ?? body.id
  const result = scheduler.handleWebhookEvent(db, { ...body, id: eventId, data: { ...body.data, summary: body.data.summary ?? null } as Parameters<typeof scheduler.handleWebhookEvent>[1]['data'] })
  return c.json({ ok: true, ...result }, 200)
})

export const schedulerRoutes = new Hono().post('/tick', async (c) => {
  const result = await scheduler.tick(db, defaultProvider(), { webhookUrl: calleConfig.webhookUrl })
  return c.json(result, 200)
})

export async function runScheduledTick() {
  if (!providerConfigured()) return
  try {
    await scheduler.tick(db, defaultProvider(), { webhookUrl: calleConfig.webhookUrl })
  } catch (error) {
    console.error('Outreach tick failed:', error instanceof Error ? error.message : error)
  }
}
