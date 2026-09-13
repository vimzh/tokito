import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db'
import { beginOAuth, completeOAuth, consumeState, disconnect, listConnections, OAuthError } from '../integrations/connections'
import { integrationConfig } from '../integrations/config'
import { validationHook } from '../validation/hook'

const providerParam = z.enum(['google', 'notion'])
const startQuery = z.object({ returnTo: z.string().max(500).optional() })
const callbackQuery = z.object({ code: z.string().optional(), state: z.string().optional(), error: z.string().optional() })

const safeReturn = (value?: string) => (value && value.startsWith('/') ? `${integrationConfig.webOrigin}${value}` : `${integrationConfig.webOrigin}/connections`)

export const connectionRoutes = new Hono()
  .get('/', (c) => c.json(listConnections(db), 200))
  .get('/:provider/start', zValidator('query', startQuery, validationHook), (c) => {
    const provider = providerParam.parse(c.req.param('provider'))
    const { url } = beginOAuth(provider, safeReturn(c.req.valid('query').returnTo))
    return c.redirect(url, 302)
  })
  .get('/:provider/callback', zValidator('query', callbackQuery, validationHook), async (c) => {
    const provider = providerParam.parse(c.req.param('provider'))
    const { code, state, error } = c.req.valid('query')
    let returnTo = `${integrationConfig.webOrigin}/connections`
    try {
      if (!state) throw new OAuthError('Missing state.')
      returnTo = consumeState(state).returnTo
      if (error || !code) throw new OAuthError(error ? `The provider reported: ${error}` : 'No authorization code was returned.')
      await completeOAuth(db, provider, code)
      return c.redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}connected=${provider}`, 302)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Connection failed.'
      return c.redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}connectError=${encodeURIComponent(message)}`, 302)
    }
  })
  .delete('/:provider', (c) => {
    disconnect(db, providerParam.parse(c.req.param('provider')))
    return c.body(null, 204)
  })
