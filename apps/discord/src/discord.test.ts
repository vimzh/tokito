import { describe, expect, test } from 'bun:test'
import { createApi, resolveCampaign, type FetchLike } from './api'
import { handleCommand } from './commands'
import { Confirmations, executePending } from './confirmations'
import { chunk, eventMessage, importMessage } from './format'
import { pollOnce } from './notifications'
import { buildTools, type ToolContext } from './tools'

// A fake Tokito API: records every request and answers from fixtures.
function fakeApi() {
  const calls: { method: string; path: string; body?: unknown }[] = []
  const campaigns = [
    { id: 'c1', name: 'Menu feedback', goal: 'Menu views', status: 'draft', questionSource: 'ai', conversationMode: 'dynamic', createdAt: 1, updatedAt: 1, questionCount: 2, contactCount: 3, readyCount: 2, responseCount: 0 },
    { id: 'c2', name: 'Society event feedback', goal: 'Event', status: 'running', questionSource: 'manual', conversationMode: 'dynamic', createdAt: 1, updatedAt: 1, questionCount: 1, contactCount: 0, readyCount: 0, responseCount: 0 },
  ]
  let settings: Record<string, unknown> = { id: 'default', discordChannelId: null }
  const fetchImpl: FetchLike = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)
    const method = init?.method ?? 'GET'
    let body: unknown
    if (init?.body && typeof init.body === 'string') body = JSON.parse(init.body)
    if (init?.body instanceof FormData) body = { file: (init.body.get('file') as File).name }
    calls.push({ method, path: url.pathname + url.search, body })
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
    if (url.pathname === '/api/campaigns' && method === 'GET') return json(campaigns)
    if (url.pathname === '/api/campaigns' && method === 'POST') return json({ id: 'c3', name: (body as { name: string }).name, questions: [], goal: (body as { goal: string }).goal, context: null, status: 'draft' }, 201)
    if (url.pathname === '/api/campaigns/c1/outreach/start') return json({ id: 'c1', status: 'running' })
    if (url.pathname === '/api/campaigns/c1/outreach/pause') return json({ id: 'c1', status: 'paused' })
    if (url.pathname === '/api/campaigns/c1/questions' && method === 'PUT') return json({ id: 'c1', questions: (body as { questions: unknown[] }).questions })
    if (url.pathname === '/api/campaigns/c1/contacts/imports' && method === 'POST') return json({ importId: 'imp1', fileName: 'contacts.csv', total: 5, counts: { ready: 2, invalid: 2, duplicate: 1, opted_out: 0, excluded: 0 } }, 201)
    if (url.pathname === '/api/settings' && method === 'GET') return json(settings)
    if (url.pathname === '/api/settings' && method === 'PUT') { settings = { ...settings, ...(body as object) }; return json(settings) }
    if (url.pathname === '/api/events' && method === 'GET') return json([
      { id: 'e1', campaignId: 'c1', campaignName: 'Menu feedback', type: 'outreach.paused', payload: { status: 'paused' }, createdAt: 100 },
      { id: 'e2', campaignId: 'c1', campaignName: 'Menu feedback', type: 'campaign.updated', payload: {}, createdAt: 101 },
      { id: 'e3', campaignId: 'c1', campaignName: 'Menu feedback', type: 'webhook.call.completed', payload: { outcome: 'callback_requested' }, createdAt: 102 },
    ])
    if (url.pathname === '/api/events' && method === 'POST') return json({ ok: true }, 201)
    return json({ error: { message: `unhandled ${method} ${url.pathname}` } }, 404)
  }
  return { api: createApi('http://fake', fetchImpl), calls, fetchImpl }
}

describe('campaign resolution', () => {
  test('matches by id, exact name, or unique fragment; reports ambiguity', async () => {
    const { api } = fakeApi()
    expect((await resolveCampaign(api, 'c2')).name).toBe('Society event feedback')
    expect((await resolveCampaign(api, 'menu FEEDBACK')).id).toBe('c1')
    expect((await resolveCampaign(api, 'society')).id).toBe('c2')
    await expect(resolveCampaign(api, 'feedback')).rejects.toThrow('matches several')
    await expect(resolveCampaign(api, 'nothing')).rejects.toThrow('No campaign matches')
  })
})

describe('confirmations', () => {
  test('only the requester can confirm, and only before expiry', () => {
    const confirmations = new Confirmations()
    const pending = confirmations.create({ kind: 'start', campaignId: 'c1', campaignName: 'Menu feedback', userId: 'u1', username: 'asha', description: 'd' }, 1000)
    expect(confirmations.take(pending.id, 'u2', 2000)).toEqual({ ok: false, reason: 'not_yours' })
    expect(confirmations.take(pending.id, 'u1', 1000 + 11 * 60_000)).toEqual({ ok: false, reason: 'expired' })
    const again = confirmations.create({ kind: 'start', campaignId: 'c1', campaignName: 'Menu feedback', userId: 'u1', username: 'asha', description: 'd' }, 1000)
    expect(confirmations.take(again.id, 'u1', 2000)).toMatchObject({ ok: true })
    expect(confirmations.take(again.id, 'u1', 2000)).toEqual({ ok: false, reason: 'unknown' })
  })
})

describe('slash commands', () => {
  test('start proposes and never calls the API until confirmed; confirmation executes and records who did it', async () => {
    const { api, calls } = fakeApi()
    const confirmations = new Confirmations()
    const reply = await handleCommand(api, confirmations, { subcommand: 'start', options: { campaign: 'menu' }, userId: 'u1', username: 'asha', channelId: 'ch' })
    expect(reply.pending?.kind).toBe('start')
    expect(reply.text).toContain('Confirm')
    expect(calls.some((c) => c.path.includes('/outreach/start'))).toBe(false)
    const taken = confirmations.take(reply.pending!.id, 'u1')
    expect(taken.ok).toBe(true)
    if (taken.ok) expect(await executePending(api, taken.pending)).toContain('Calling started')
    expect(calls.some((c) => c.method === 'POST' && c.path === '/api/campaigns/c1/outreach/start')).toBe(true)
    const activity = calls.find((c) => c.method === 'POST' && c.path === '/api/events')
    expect(activity?.body).toMatchObject({ campaignId: 'c1', type: 'discord.action', payload: { action: 'start', actor: { source: 'discord', userId: 'u1', username: 'asha' } } })
  })

  test('link stores the channel and campaigns lists them', async () => {
    const { api, calls } = fakeApi()
    const confirmations = new Confirmations()
    await handleCommand(api, confirmations, { subcommand: 'link', options: {}, userId: 'u1', username: 'asha', channelId: 'chan-9' })
    expect(calls.find((c) => c.method === 'PUT' && c.path === '/api/settings')?.body).toEqual({ discordChannelId: 'chan-9' })
    const list = await handleCommand(api, confirmations, { subcommand: 'campaigns', options: {}, userId: 'u1', username: 'asha', channelId: 'chan-9' })
    expect(list.text).toContain('Menu feedback')
    expect(list.text).toContain('Society event feedback')
  })
})

describe('agent tools', () => {
  function ctx(overrides: Partial<ToolContext> = {}): ToolContext {
    const { api, fetchImpl, calls } = fakeApi()
    const attachmentFetch: FetchLike = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (url.startsWith('https://cdn.discord/')) return new Response('name,phone\nAsha,9876543210\n')
      return fetchImpl(input, init)
    }
    const context: ToolContext = { api, confirmations: new Confirmations(), userId: 'u1', username: 'asha', channelId: 'ch', attachments: [], fetchImpl: attachmentFetch, created: [], ...overrides }
    return Object.assign(context, { calls }) as ToolContext & { calls: typeof calls }
  }
  const invoke = async (context: ToolContext, name: string, input: unknown) => {
    const found = buildTools(context).find((t) => t.name === name)!
    return found.invoke(input as never)
  }

  test('import_contacts downloads and imports an exact name, phone attachment', async () => {
    const context = ctx({ attachments: [{ name: 'contacts.csv', url: 'https://cdn.discord/contacts.csv' }] }) as ToolContext & { calls: { path: string; body?: unknown }[] }
    const result = await invoke(context, 'import_contacts', { campaign: 'menu' })
    expect(String(result)).toContain('Ready to call 2 · Invalid 2 · Duplicates 1')
    expect(context.calls.find((c) => c.path === '/api/campaigns/c1/contacts/imports')?.body).toEqual({ file: 'contacts.csv' })
    expect(context.calls.some((c) => c.path.endsWith('/commit'))).toBe(false)
  })

  test('change_outreach and set_questions only create pending confirmations', async () => {
    const context = ctx() as ToolContext & { calls: { path: string }[] }
    const text = String(await invoke(context, 'change_outreach', { campaign: 'menu', command: 'start' }))
    expect(text).toContain('Confirmation required')
    expect(context.created).toHaveLength(1)
    expect(context.created[0]?.kind).toBe('start')
    await invoke(context, 'set_questions', { campaign: 'menu', questions: [{ text: 'Tried it?', type: 'choice', options: ['Yes', 'No'], required: true }] })
    expect(context.created[1]?.payload?.questions?.[0]).toMatchObject({ text: 'Tried it?', options: ['Yes', 'No'], source: 'ai' })
    expect(context.calls.some((c) => c.path.includes('/outreach/start') || c.path.endsWith('/questions'))).toBe(false)
  })

  test('create_campaign creates a draft and records the actor', async () => {
    const context = ctx() as ToolContext & { calls: { path: string; method: string; body?: unknown }[] }
    const text = String(await invoke(context, 'create_campaign', { name: 'Workshop', goal: 'How did it go?', conversationMode: 'dynamic' }))
    expect(text).toContain('Created campaign "Workshop"')
    expect(context.calls.find((c) => c.method === 'POST' && c.path === '/api/campaigns')?.body).toMatchObject({ name: 'Workshop', questionSource: 'ai' })
    expect(context.calls.find((c) => c.method === 'POST' && c.path === '/api/events')?.body).toMatchObject({ type: 'discord.action', payload: { action: 'create_campaign' } })
  })
})

describe('notifications and formatting', () => {
  test('posts only notable events to the linked channel and advances the cursor', async () => {
    const { api } = fakeApi()
    const posted: string[] = []
    await api.updateSettings({ discordChannelId: 'chan-1' })
    const cursor = await pollOnce(api, async (_channel, text) => { posted.push(text) }, 0)
    expect(cursor).toBe(102)
    expect(posted).toHaveLength(2)
    expect(posted[0]).toContain('paused')
    expect(posted[1]).toContain('callback')
    expect(eventMessage({ id: 'x', campaignId: 'c1', campaignName: 'M', type: 'campaign.updated', payload: {}, createdAt: 1 })).toBeNull()
  })

  test('long replies are split under the Discord limit', () => {
    const parts = chunk(Array.from({ length: 300 }, (_, i) => `line ${i} ${'x'.repeat(20)}`).join('\n'))
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.every((p) => p.length <= 2000)).toBe(true)
    expect(importMessage({ importId: 'i', fileName: 'f.csv', total: 1, counts: { ready: 1, invalid: 0, duplicate: 0, opted_out: 0, excluded: 0 } })).toContain('Ready to call 1')
  })
})
