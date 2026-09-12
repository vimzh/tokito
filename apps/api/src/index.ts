import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { campaignRoutes } from './routes/campaigns'
import { settingsRoutes } from './routes/settings'
import { optOutRoutes } from './routes/opt-outs'
import { ImportStateError } from './services/contacts'
import { InvalidPhoneError } from './services/opt-outs'
import { SpreadsheetError } from './services/spreadsheet'
import { SimulationError } from './calls/simulator'
import { OutreachError } from './calls/scheduler'
import { ProviderError, ProviderNotConfiguredError } from './calls/provider'
import { runScheduledTick, schedulerRoutes, webhookRoutes } from './routes/outreach'
import { NotFoundError } from './services/campaigns'
import { AiNotConfiguredError, AiRequestError } from './ai/config'

const app = new Hono()
  .use('/api/*', cors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' }))
  .onError((error, c) => {
    if (error instanceof NotFoundError) return c.json({ error: { message: error.message } }, 404)
    if (error instanceof SpreadsheetError || error instanceof ImportStateError || error instanceof InvalidPhoneError || error instanceof SimulationError || error instanceof OutreachError)
      return c.json({ error: { message: error.message } }, 400)
    if (error instanceof AiNotConfiguredError || error instanceof ProviderNotConfiguredError) return c.json({ error: { message: error.message } }, 503)
    if (error instanceof ProviderError) return c.json({ error: { message: error.message, code: error.code } }, 502)
    if (error instanceof AiRequestError) return c.json({ error: { message: error.message } }, 502)
    if (error instanceof HTTPException) return c.json({ error: { message: error.message } }, error.status)
    console.error(error)
    return c.json({ error: { message: 'Something went wrong.' } }, 500)
  })
  .notFound((c) => c.json({ error: { message: 'Route not found' } }, 404))
  .get('/api/health', (c) => c.json({ ok: true }))
  .route('/api/campaigns', campaignRoutes)
  .route('/api/settings', settingsRoutes)
  .route('/api/opt-outs', optOutRoutes)
  .route('/api/webhooks', webhookRoutes)
  .route('/api/outreach', schedulerRoutes)

export type AppType = typeof app

// One scheduler loop per process; --hot reloads re-run this module, so clear the previous timer.
const tickSeconds = Number(process.env.OUTREACH_TICK_SECONDS ?? 30)
const globalTimers = globalThis as typeof globalThis & { __tokitoTick?: ReturnType<typeof setInterval> }
if (globalTimers.__tokitoTick) clearInterval(globalTimers.__tokitoTick)
globalTimers.__tokitoTick = setInterval(() => void runScheduledTick(), Math.max(5, tickSeconds) * 1000)

export default { port: Number(process.env.PORT ?? 3002), fetch: app.fetch }
