import { tool } from '@strands-agents/sdk'
import { z } from 'zod'
import { resolveCampaign, type Api, type FetchLike } from './api'
import { Confirmations, describeAction, type Pending, type PendingKind } from './confirmations'
import { campaignList, importMessage, questionList, reportMessage, askMessage, statusMessage } from './format'
import { campaignUrl } from './config'

export type ToolContext = {
  api: Api
  confirmations: Confirmations
  userId: string
  username: string
  channelId: string
  attachments: { name: string; url: string }[]
  fetchImpl?: FetchLike
  created: Pending[]
}

const questionInput = z.object({
  text: z.string().min(1),
  type: z.enum(['open', 'rating', 'choice']).default('open'),
  options: z.array(z.string()).default([]),
  required: z.boolean().default(true),
})

// Tools the Discord agent can call. State changes go through `created` pending actions, never directly.
export function buildTools(ctx: ToolContext) {
  const { api } = ctx
  const propose = async (campaignRef: string, kind: PendingKind, payload?: Pending['payload']) => {
    const campaign = await resolveCampaign(api, campaignRef)
    const pending = ctx.confirmations.create({ kind, campaignId: campaign.id, campaignName: campaign.name, userId: ctx.userId, username: ctx.username, description: describeAction(kind, campaign.name), payload })
    ctx.created.push(pending)
    return `Confirmation required before this happens: ${pending.description} Tell the user to press Confirm on the buttons below this message. Do not claim it has happened.`
  }

  return [
    tool({
      name: 'list_campaigns',
      description: 'List all campaigns with status, contacts, and responses.',
      inputSchema: z.object({}),
      callback: async () => campaignList(await api.listCampaigns()),
    }),
    tool({
      name: 'get_campaign',
      description: 'Show a campaign: goal, background, questions, preferences, outreach status, and progress. Accepts the campaign id or part of its name.',
      inputSchema: z.object({ campaign: z.string() }),
      callback: async ({ campaign: ref }) => {
        const summary = await resolveCampaign(api, ref)
        const [campaign, outreach, results] = await Promise.all([api.getCampaign(summary.id), api.getOutreach(summary.id), api.getResults(summary.id)])
        return `${statusMessage(campaign, outreach, results)}\nBackground: ${campaign.context ?? 'none'}\nQuestions:\n${questionList(campaign)}`
      },
    }),
    tool({
      name: 'create_campaign',
      description: 'Create a new draft campaign from a name and a goal. Questions are drafted separately with draft_questions.',
      inputSchema: z.object({ name: z.string().min(1).max(120), goal: z.string().min(1).max(2000), context: z.string().max(4000).optional(), conversationMode: z.enum(['dynamic', 'fixed']).default('dynamic') }),
      callback: async (input) => {
        const campaign = await api.createCampaign({ name: input.name, goal: input.goal, context: input.context, questionSource: 'ai', conversationMode: input.conversationMode })
        await api.recordActivity({ campaignId: campaign.id, type: 'discord.action', payload: { action: 'create_campaign', actor: { source: 'discord', userId: ctx.userId, username: ctx.username } } }).catch(() => undefined)
        return `Created campaign "${campaign.name}" (id ${campaign.id}) as a draft: <${campaignUrl(campaign.id)}>. Next: draft questions, then import contacts.`
      },
    }),
    tool({
      name: 'draft_questions',
      description: 'Ask the AI to draft questions for a campaign. Returns a proposal; nothing is saved until set_questions is confirmed.',
      inputSchema: z.object({ campaign: z.string() }),
      callback: async ({ campaign: ref }) => {
        const summary = await resolveCampaign(api, ref)
        const draft = await api.draftQuestions(summary.id)
        return `Proposed questions for "${summary.name}" (not saved yet):\n${draft.questions.map((q, i) => `${i + 1}. ${q.text} [${q.type}${q.options.length ? `: ${q.options.join(' / ')}` : ''}${q.required ? '' : ', optional'}]`).join('\n')}\nTo save them, call set_questions with these questions; the user must then confirm.`
      },
    }),
    tool({
      name: 'set_questions',
      description: 'Replace the campaign questions with the given list. Requires the user to confirm; existing questions are replaced.',
      inputSchema: z.object({ campaign: z.string(), questions: z.array(questionInput).min(1).max(50) }),
      callback: ({ campaign: ref, questions }) => propose(ref, 'set_questions', { questions: questions.map((q) => ({ ...q, options: q.type === 'choice' ? q.options : [], source: 'ai' as const })) }),
    }),
    tool({
      name: 'import_contacts',
      description: 'Import the spreadsheet attached to the message. It must contain exactly two columns in this order: name, phone.',
      inputSchema: z.object({ campaign: z.string(), attachmentName: z.string().optional() }),
      callback: async ({ campaign: ref, attachmentName }) => {
        const summary = await resolveCampaign(api, ref)
        const attachment = ctx.attachments.find((a) => (attachmentName ? a.name === attachmentName : /\.(xlsx|xls|csv)$/i.test(a.name))) ?? ctx.attachments[0]
        if (!attachment) return 'No spreadsheet was attached to the message. Ask the user to attach an .xlsx, .xls, or .csv file.'
        const response = await (ctx.fetchImpl ?? fetch)(attachment.url)
        if (!response.ok) return `Could not download ${attachment.name} (${response.status}).`
        const file = new File([await response.arrayBuffer()], attachment.name)
        const result = await api.uploadContacts(summary.id, file)
        await api.recordActivity({ campaignId: summary.id, type: 'discord.action', payload: { action: 'import_contacts', file: attachment.name, actor: { source: 'discord', userId: ctx.userId, username: ctx.username } } }).catch(() => undefined)
        return importMessage(result)
      },
    }),
    tool({
      name: 'get_contacts',
      description: 'Show contact counts by status and the rows with problems for a campaign.',
      inputSchema: z.object({ campaign: z.string() }),
      callback: async ({ campaign: ref }) => {
        const summary = await resolveCampaign(api, ref)
        const list = await api.listContacts(summary.id)
        const problems = list.contacts.filter((c) => c.status !== 'ready').slice(0, 15).map((c) => `• ${c.name ?? 'no name'} ${c.phoneRaw}: ${c.status}${c.problem ? ` (${c.problem})` : ''}`)
        return `${summary.name}: ${list.total} contacts. Ready ${list.counts.ready} · Invalid ${list.counts.invalid} · Duplicate ${list.counts.duplicate} · Opted out ${list.counts.opted_out} · Excluded ${list.counts.excluded}${problems.length ? `\n${problems.join('\n')}` : ''}`
      },
    }),
    tool({
      name: 'change_outreach',
      description: 'Start, resume, pause, or stop calling for a campaign. Always requires the user to confirm with a button.',
      inputSchema: z.object({ campaign: z.string(), command: z.enum(['start', 'resume', 'pause', 'stop']) }),
      callback: ({ campaign: ref, command }) => propose(ref, command === 'resume' ? 'start' : command),
    }),
    tool({
      name: 'get_results',
      description: 'Show progress and what people answered per question, with quotes.',
      inputSchema: z.object({ campaign: z.string() }),
      callback: async ({ campaign: ref }) => {
        const summary = await resolveCampaign(api, ref)
        const results = await api.getResults(summary.id)
        const lines = [`${summary.name}: ${results.responses.total} responses${results.responses.simulated ? ` (${results.responses.simulated} text simulations)` : ''}.`]
        for (const q of results.questions) {
          lines.push(`\n${q.position + 1}. ${q.text} — answered ${q.statusCounts.answered}, skipped ${q.statusCounts.skipped}, declined ${q.statusCounts.declined}, not asked ${q.statusCounts.not_asked}`)
          if (q.rating) lines.push(`   average ${q.rating.average ?? 'n/a'}; distribution ${Object.entries(q.rating.distribution).map(([k, v]) => `${k}:${v}`).join(' ')}`)
          if (q.choice) lines.push(`   ${q.choice.totals.map((t) => `${t.option}: ${t.count}`).join(', ')}${q.choice.other ? `, other: ${q.choice.other}` : ''}`)
          for (const a of q.answers.filter((a) => a.status === 'answered').slice(0, 5)) lines.push(`   "${a.value}"${a.notes ? ` (${a.notes})` : ''} — ${a.person ?? 'unnamed'}`)
        }
        return lines.join('\n')
      },
    }),
    tool({
      name: 'get_report',
      description: 'Show the latest report for a campaign, or generate one when none exists yet or the user asks for a new version.',
      inputSchema: z.object({ campaign: z.string(), generate: z.boolean().default(false) }),
      callback: async ({ campaign: ref, generate }) => {
        const summary = await resolveCampaign(api, ref)
        const existing = await api.getReport(summary.id)
        if (!existing.report || generate) {
          const report = await api.generateReport(summary.id)
          return reportMessage(summary.id, report.content, report.version)
        }
        return reportMessage(summary.id, existing.report.content, existing.report.version)
      },
    }),
    tool({
      name: 'ask_report',
      description: 'Answer a question about what people said, with citations to their answers.',
      inputSchema: z.object({ campaign: z.string(), question: z.string().min(3).max(500) }),
      callback: async ({ campaign: ref, question }) => askMessage((await resolveCampaign(api, ref)).id, await api.askReport((await resolveCampaign(api, ref)).id, question)),
    }),
    tool({
      name: 'link_channel',
      description: 'Make the current Discord channel the place where Tokito posts notifications.',
      inputSchema: z.object({}),
      callback: async () => {
        await api.updateSettings({ discordChannelId: ctx.channelId })
        return 'This channel now receives Tokito notifications.'
      },
    }),
  ]
}
