import { Hono } from 'hono'
import { bearerAuth } from 'hono/bearer-auth'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { HTTPException } from 'hono/http-exception'
import { campaignRoutes } from './routes/campaigns'
import { settingsRoutes } from './routes/settings'
import { optOutRoutes } from './routes/opt-outs'
import { eventRoutes } from './routes/events'
import { connectionRoutes } from './routes/connections'
import { IntegrationError } from './integrations/http'
import { NotConnectedError, OAuthError } from './integrations/connections'
import { ConnectionConfigError } from './integrations/campaign-connections'
import { registerIntegrations } from './integrations/register'
import { ImportStateError } from './services/contacts'
import { InvalidPhoneError } from './services/opt-outs'
import { SpreadsheetError } from './services/spreadsheet'
import { SimulationError } from './calls/simulator'
import { OutreachError } from './calls/scheduler'
import { ReportError } from './reports/generate'
import { ProviderError, ProviderNotConfiguredError } from './calls/provider'
import { runScheduledTick, schedulerRoutes, webhookRoutes } from './routes/outreach'
import { NotFoundError } from './services/campaigns'
import { AiNotConfiguredError, AiRequestError } from './ai/config'

// Routes that outside services or a browser redirect must reach without the workspace token.
const publicPaths = [/^\/api\/health$/, /^\/api\/webhooks\//, /^\/api\/connections\/[a-z]+\/(start|callback)$/]
const apiToken = process.env.API_TOKEN

const app = new Hono()
  .use(logger())
  .use('/api/*', cors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' }))
  .use('/api/*', async (c, next) => {
    if (!apiToken || publicPaths.some((pattern) => pattern.test(c.req.path))) return next()
    return bearerAuth({ token: apiToken })(c, next)
  })
  .onError((error, c) => {
    if (error instanceof NotFoundError) return c.json({ error: { message: error.message } }, 404)
    if (error instanceof SpreadsheetError || error instanceof ImportStateError || error instanceof InvalidPhoneError || error instanceof SimulationError || error instanceof OutreachError || error instanceof ReportError || error instanceof OAuthError || error instanceof ConnectionConfigError || error instanceof NotConnectedError)
      return c.json({ error: { message: error.message } }, 400)
    if (error instanceof AiNotConfiguredError || error instanceof ProviderNotConfiguredError) return c.json({ error: { message: error.message } }, 503)
    if (error instanceof ProviderError) return c.json({ error: { message: error.message, code: error.code } }, 502)
    if (error instanceof IntegrationError) return c.json({ error: { message: `${error.provider}: ${error.message}` } }, 502)
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
  .route('/api/events', eventRoutes)
  .route('/api/connections', connectionRoutes)
  .route('/api/webhooks', webhookRoutes)
  .route('/api/outreach', schedulerRoutes)

export type AppType = typeof app
export { app }

registerIntegrations()

// One scheduler loop per process (skipped under tests); --hot reloads re-run this module, so clear the previous timer.
const tickSeconds = Number(process.env.OUTREACH_TICK_SECONDS ?? 30)
const globalTimers = globalThis as typeof globalThis & { __tokitoTick?: ReturnType<typeof setInterval> }
if (globalTimers.__tokitoTick) clearInterval(globalTimers.__tokitoTick)
if (process.env.NODE_ENV !== 'test') globalTimers.__tokitoTick = setInterval(() => void runScheduledTick(), Math.max(5, tickSeconds) * 1000)

export default { port: Number(process.env.PORT ?? 3002), fetch: app.fetch }
