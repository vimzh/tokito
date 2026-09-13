import { and, eq } from 'drizzle-orm'
import type { Db } from '../db'
import { campaigns, reports } from '../db/schema'
import type { ReportContent, ReportQuote } from '../reports/generate'
import { accessToken } from './connections'
import { getCampaignConnection, recordSync } from './campaign-connections'
import { requestJson } from './http'

const NOTION_VERSION = '2022-06-28'
type Block = Record<string, unknown>

const text = (content: string, link?: string) => ({ type: 'text', text: { content: content.slice(0, 1900), ...(link ? { link: { url: link } } : {}) } })
const paragraph = (content: string): Block => ({ object: 'block', type: 'paragraph', paragraph: { rich_text: [text(content)] } })
const heading = (content: string, level: 1 | 2 | 3): Block => ({ object: 'block', type: `heading_${level}`, [`heading_${level}`]: { rich_text: [text(content)] } })
const bullet = (content: string): Block => ({ object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [text(content)] } })
const callout = (content: string): Block => ({ object: 'block', type: 'callout', callout: { rich_text: [text(content)], icon: { type: 'emoji', emoji: 'ℹ️' } } })

function quoteBlock(quote: ReportQuote, dashboardUrl: string, campaignId: string): Block {
  const body = quote.value ? `“${quote.value}”` : `[${quote.status}]`
  const who = `${quote.person ?? 'Unnamed'}${quote.simulated ? ' (text simulation)' : ''} · ${quote.questionText}`
  return { object: 'block', type: 'quote', quote: { rich_text: [text(`${body}${quote.notes ? ` — ${quote.notes}` : ''}\n`), text(who, `${dashboardUrl}/survey/${campaignId}/calls/${quote.callId}`)] } }
}

// Turns a stored report into Notion blocks. Quotes stay quotes; AI text is labeled.
export function buildReportBlocks(content: ReportContent, campaignId: string, dashboardUrl: string): Block[] {
  const blocks: Block[] = []
  blocks.push(callout(`AI summary: ${content.headline}`))
  blocks.push(paragraph(`${content.responses.total} completed responses from ${content.participation.people} people in the list (${content.participation.reached} reached, ${content.participation.completed} completed, ${content.participation.callbacks} callbacks pending, ${content.participation.unreachable} unreachable, ${content.participation.optedOut} opted out).${content.responses.simulated ? ` ${content.responses.simulated} responses are text simulations.` : ''} The people who answered are not automatically representative of everyone.`))
  blocks.push(heading('What people said', 2))
  blocks.push(paragraph('People counts are the people whose answers are cited under each finding, not everyone who may agree.'))
  if (content.themes.length === 0) blocks.push(paragraph('None found in the answers.'))
  for (const theme of content.themes) {
    blocks.push(heading(`${theme.title} (${theme.kind}; cited from ${theme.peopleCount} ${theme.peopleCount === 1 ? 'person' : 'people'})`, 3))
    blocks.push(paragraph(`AI summary: ${theme.description}`))
    for (const quote of theme.quotes) blocks.push(quoteBlock(quote, dashboardUrl, campaignId))
  }
  if (content.disagreements.length) {
    blocks.push(heading('Where people disagree', 2))
    for (const item of content.disagreements) {
      blocks.push(heading(item.topic, 3))
      blocks.push(paragraph(`AI summary: ${item.description}`))
      for (const side of item.sides) {
        blocks.push(bullet(`${side.position} (${side.peopleCount} ${side.peopleCount === 1 ? 'person' : 'people'})`))
        for (const quote of side.quotes) blocks.push(quoteBlock(quote, dashboardUrl, campaignId))
      }
    }
  }
  if (content.requests.length) {
    blocks.push(heading('Requests for the organizer', 2))
    for (const item of content.requests) {
      blocks.push(bullet(`AI summary: ${item.description}`))
      for (const quote of item.quotes) blocks.push(quoteBlock(quote, dashboardUrl, campaignId))
    }
  }
  blocks.push(heading('Gaps', 2))
  blocks.push(paragraph(`${content.participation.unreachable} unreachable · ${content.participation.callbacks} callbacks pending · ${content.participation.declined} declined to take part`))
  for (const gap of content.gaps) {
    const parts = [gap.skipped && `${gap.skipped} skipped`, gap.declined && `${gap.declined} declined`, gap.unknown && `${gap.unknown} did not know`, gap.notAsked && `${gap.notAsked} not asked`, gap.missing && `${gap.missing} no record`].filter(Boolean)
    blocks.push(bullet(`${gap.questionText}: ${parts.join(', ')}`))
  }
  blocks.push(heading('Suggested next steps (AI suggestions)', 2))
  if (content.nextSteps.length === 0) blocks.push(paragraph('None.'))
  for (const step of content.nextSteps) {
    blocks.push(bullet(step.suggestion))
    for (const quote of step.quotes) blocks.push(quoteBlock(quote, dashboardUrl, campaignId))
  }
  blocks.push(paragraph(`Full report and transcripts: ${dashboardUrl}/survey/${campaignId}`))
  return blocks
}

export async function publishReportToNotion(db: Db, campaignId: string, version: number, dashboardUrl: string) {
  const connection = getCampaignConnection(db, campaignId, 'notion')
  if (!connection?.config.parentPageId || !connection.enabled) throw new Error('No Notion page is configured for this campaign.')
  const report = db.select().from(reports).where(and(eq(reports.campaignId, campaignId), eq(reports.version, version))).get()
  if (!report) throw new Error('Report version not found.')
  const campaign = db.select().from(campaigns).where(eq(campaigns.id, campaignId)).get()!
  try {
    const token = await accessToken(db, 'notion')
    const headers = { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION }
    const blocks = buildReportBlocks(report.content as unknown as ReportContent, campaignId, dashboardUrl)
    const page = await requestJson<{ id: string; url: string }>('notion', 'https://api.notion.com/v1/pages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        parent: { page_id: connection.config.parentPageId },
        properties: { title: { title: [text(`${campaign.name} — Tokito report v${version}`)] } },
        children: blocks.slice(0, 100),
      }),
    })
    for (let start = 100; start < blocks.length; start += 100) {
      await requestJson('notion', `https://api.notion.com/v1/blocks/${page.id}/children`, { method: 'PATCH', headers, body: JSON.stringify({ children: blocks.slice(start, start + 100) }) })
    }
    db.update(reports).set({ externalUrl: page.url }).where(eq(reports.id, report.id)).run()
    recordSync(db, campaignId, 'notion', { ok: true, externalUrl: page.url, detail: { action: 'publish', version, blocks: blocks.length } })
    return page.url
  } catch (error) {
    recordSync(db, campaignId, 'notion', { ok: false, error: error instanceof Error ? error.message : String(error), detail: { action: 'publish', version } })
    throw error
  }
}
