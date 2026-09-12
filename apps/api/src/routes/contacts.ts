import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { db } from '../db'
import * as service from '../services/contacts'
import { validationHook } from '../validation/hook'
import { commitImportSchema, updateContactSchema } from '../validation/contacts'

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

// Mounted under /api/campaigns; full paths keep the :id param typed.
export const contactRoutes = new Hono()
  .get('/:id/contacts', (c) => c.json(service.listContacts(db, c.req.param('id')), 200))
  .post('/:id/contacts/imports', zValidator('form', z.object({ file: z.instanceof(File) }), validationHook), async (c) => {
    const { file } = c.req.valid('form')
    if (file.size > MAX_UPLOAD_BYTES) throw new HTTPException(400, { message: 'The file is larger than 5 MB.' })
    return c.json(service.createImport(db, c.req.param('id'), file.name, await file.arrayBuffer()), 201)
  })
  .get('/:id/contacts/imports/:importId', (c) => {
    const row = service.getImport(db, c.req.param('id'), c.req.param('importId'))
    return c.json({ id: row.id, fileName: row.fileName, headers: row.headers, rowCount: row.rows.length, mapping: row.mapping, committedAt: row.committedAt }, 200)
  })
  .post('/:id/contacts/imports/:importId/commit', zValidator('json', commitImportSchema, validationHook), (c) =>
    c.json(service.commitImport(db, c.req.param('id'), c.req.param('importId'), c.req.valid('json')), 200),
  )
  .patch('/:id/contacts/:contactId', zValidator('json', updateContactSchema, validationHook), (c) =>
    c.json(service.updateContact(db, c.req.param('id'), c.req.param('contactId'), c.req.valid('json')), 200),
  )
  .delete('/:id/contacts/:contactId', (c) => {
    service.deleteContact(db, c.req.param('id'), c.req.param('contactId'))
    return c.body(null, 204)
  })
