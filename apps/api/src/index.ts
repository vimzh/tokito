import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { campaignRoutes } from './routes/campaigns'
import { NotFoundError } from './services/campaigns'

const app = new Hono()
  .use('/api/*', cors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' }))
  .onError((error, c) => {
    if (error instanceof NotFoundError) return c.json({ error: { message: error.message } }, 404)
    if (error instanceof HTTPException) return c.json({ error: { message: error.message } }, error.status)
    console.error(error)
    return c.json({ error: { message: 'Something went wrong.' } }, 500)
  })
  .notFound((c) => c.json({ error: { message: 'Route not found' } }, 404))
  .get('/api/health', (c) => c.json({ ok: true }))
  .route('/api/campaigns', campaignRoutes)

export type AppType = typeof app

export default { port: Number(process.env.PORT ?? 3002), fetch: app.fetch }
