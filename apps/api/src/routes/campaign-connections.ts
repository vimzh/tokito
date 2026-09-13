import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db'
import { listCampaignConnections, parseNotionPageId, parseSpreadsheetId, removeCampaignConnection, setCampaignConnection } from '../integrations/campaign-connections'
import { importContactsFromSheet, syncResultsToSheet } from '../integrations/sheets'
import { publishReportToNotion } from '../integrations/notion'
import { integrationConfig } from '../integrations/config'
import { getReport } from '../reports/generate'
import { validationHook } from '../validation/hook'

const kindParam = z.enum(['sheets', 'calendar', 'notion'])
const setSchema = z.object({ url: z.string().trim().max(500).optional(), enabled: z.boolean().optional() })
const publishSchema = z.object({ version: z.number().int().min(1).optional() })

// Mounted under /api/campaigns; full paths keep the :id param typed.
export const campaignConnectionRoutes = new Hono()
  .get('/:id/connections', (c) => c.json(listCampaignConnections(db, c.req.param('id')), 200))
  .put('/:id/connections/:kind', zValidator('json', setSchema, validationHook), (c) => {
    const kind = kindParam.parse(c.req.param('kind'))
    const { url, enabled } = c.req.valid('json')
    let config: Record<string, string> | undefined
    if (url !== undefined) config = kind === 'sheets' ? { spreadsheetId: parseSpreadsheetId(url) } : kind === 'notion' ? { parentPageId: parseNotionPageId(url) } : {}
    return c.json(setCampaignConnection(db, c.req.param('id'), kind, { config, enabled }), 200)
  })
  .delete('/:id/connections/:kind', (c) => {
    removeCampaignConnection(db, c.req.param('id'), kindParam.parse(c.req.param('kind')))
    return c.body(null, 204)
  })
  .post('/:id/connections/sheets/import', async (c) => c.json(await importContactsFromSheet(db, c.req.param('id')), 201))
  .post('/:id/connections/sheets/sync', async (c) => c.json({ url: await syncResultsToSheet(db, c.req.param('id')) }, 200))
  .post('/:id/connections/notion/publish', zValidator('json', publishSchema, validationHook), async (c) => {
    const id = c.req.param('id')
    const version = c.req.valid('json').version ?? getReport(db, id).report?.version
    if (!version) return c.json({ error: { message: 'Generate a report before publishing it.' } }, 400)
    return c.json({ url: await publishReportToNotion(db, id, version, integrationConfig.webOrigin) }, 200)
  })
