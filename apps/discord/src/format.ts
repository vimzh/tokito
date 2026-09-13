import { callUrl, campaignUrl } from './config'
import type { AskResult, Campaign, CampaignResults, CampaignSummary, EventRow, ImportSummary, OutreachStatus, ReportContent } from './api'

export const DISCORD_LIMIT = 2000

export function truncate(text: string, limit = DISCORD_LIMIT) {
  return text.length <= limit ? text : `${text.slice(0, limit - 2)}…`
}

// Splits a long reply on line boundaries so every chunk fits a Discord message.
export function chunk(text: string, limit = DISCORD_LIMIT): string[] {
  if (text.length <= limit) return [text]
  const chunks: string[] = []
  let current = ''
  for (const line of text.split('\n')) {
    if ((current + '\n' + line).length > limit) {
      if (current) chunks.push(current)
      current = line.length > limit ? truncate(line, limit) : line
    } else current = current ? `${current}\n${line}` : line
  }
  if (current) chunks.push(current)
  return chunks
}

const statusLabels: Record<string, string> = { draft: 'Draft', ready: 'Ready', running: 'Running', paused: 'Paused', completed: 'Completed' }

export function campaignList(campaigns: CampaignSummary[]) {
  if (campaigns.length === 0) return 'No campaigns yet. Tell me what you want to learn and I will create one.'
  return ['**Campaigns**', ...campaigns.map((c) => `• **${c.name}** — ${statusLabels[c.status] ?? c.status} · ${c.contactCount} contacts · ${c.responseCount} responses · <${campaignUrl(c.id)}>`)].join('\n')
}

export function questionList(campaign: Pick<Campaign, 'questions'>) {
  if (campaign.questions.length === 0) return 'No questions yet.'
  return campaign.questions.map((q, i) => `${i + 1}. ${q.text}${q.type === 'rating' ? ' (rating 1–5)' : q.type === 'choice' ? ` (choice: ${(q.options ?? []).join(' / ')})` : ''}${q.required ? '' : ' (optional)'}`).join('\n')
}

const reasonLabels: Record<string, string> = {
  no_questions: 'there are no questions',
  no_ready_contacts: 'there are no ready contacts',
  provider_not_configured: 'CALL-E is not configured on the API',
  budget_reached: 'the call budget is used up',
  outside_calling_hours: 'it is outside calling hours',
}

export function statusMessage(campaign: Campaign, outreach: OutreachStatus, results: CampaignResults) {
  const p = results.participation
  const lines = [
    `**${campaign.name}** — ${statusLabels[campaign.status] ?? campaign.status} · <${campaignUrl(campaign.id)}>`,
    `Goal: ${campaign.goal}`,
    `Questions: ${campaign.questions.length} · Contacts: ${p.people} in list, ${p.ready} ready`,
    `Progress: ${p.called} called · ${p.reached} reached · ${p.completed} completed · ${p.callbacks} callbacks pending · ${p.unreachable} unreachable · ${p.optedOut} opted out`,
    `Responses: ${results.responses.total}${results.responses.simulated ? ` (${results.responses.simulated} text simulations)` : ''}`,
    `Calling: ${outreach.withinHours ? 'inside calling hours' : 'outside calling hours'} (${outreach.localTime} in ${campaign.timezone}) · ${outreach.counts.active} on a call · ${outreach.counts.queued} queued · ${outreach.counts.callsMade} calls made${outreach.counts.budget ? ` of ${outreach.counts.budget}` : ''}`,
  ]
  const blocking = outreach.reasons.filter((r) => r !== 'outside_calling_hours')
  if (blocking.length && campaign.status !== 'running') lines.push(`Cannot start yet: ${blocking.map((r) => reasonLabels[r] ?? r).join('; ')}.`)
  return lines.join('\n')
}

export function importMessage(summary: ImportSummary, mapping: { nameColumn: number | null; phoneColumn: number; contextColumns: number[] }, headers: string[]) {
  const c = summary.counts
  return [
    `Imported **${summary.fileName}**: ${summary.total} rows.`,
    `Ready to call ${c.ready} · Invalid ${c.invalid} · Duplicates ${c.duplicate} · Opted out ${c.opted_out}`,
    `Columns used: phone = "${headers[mapping.phoneColumn]}"${mapping.nameColumn === null ? '' : `, name = "${headers[mapping.nameColumn]}"`}${mapping.contextColumns.length ? `, context = ${mapping.contextColumns.map((i) => `"${headers[i]}"`).join(', ')}` : ''}.`,
    c.invalid + c.duplicate + c.opted_out > 0 ? 'Rows with problems are listed on the Contacts tab of the dashboard.' : '',
  ].filter(Boolean).join('\n')
}

export function reportMessage(campaignId: string, content: ReportContent, version: number) {
  const lines = [`**Report v${version}** · <${campaignUrl(campaignId)}>`, `_AI summary:_ ${content.headline}`, `${content.responses.total} responses from ${content.participation.people} people in the list${content.responses.simulated ? ` (${content.responses.simulated} text simulations)` : ''}.`]
  if (content.themes.length) {
    lines.push('', '**What people said**')
    for (const theme of content.themes.slice(0, 6)) {
      lines.push(`• [${theme.kind}] **${theme.title}** — cited from ${theme.peopleCount} ${theme.peopleCount === 1 ? 'person' : 'people'}. _${theme.description}_`)
      const quote = theme.quotes.find((q) => q.value)
      if (quote) lines.push(`  > “${truncate(quote.value ?? '', 180)}” — ${quote.person ?? 'unnamed'} <${callUrl(campaignId, quote.callId)}>`)
    }
  }
  if (content.gaps.length) lines.push('', `**Gaps:** ${content.gaps.map((g) => `${g.questionText.slice(0, 60)}: ${[g.skipped && `${g.skipped} skipped`, g.declined && `${g.declined} declined`, g.notAsked && `${g.notAsked} not asked`, g.missing && `${g.missing} no record`].filter(Boolean).join(', ')}`).join(' · ')}`)
  if (content.nextSteps.length) lines.push('', '**Suggested next steps (AI suggestions)**', ...content.nextSteps.slice(0, 4).map((s) => `• ${s.suggestion}`))
  return truncate(lines.join('\n'))
}

export function askMessage(campaignId: string, result: AskResult) {
  const lines = [`**Q:** ${result.question}`, `${result.notEnoughEvidence ? '_Not enough evidence._ ' : ''}${result.answer}`]
  for (const quote of result.citations.slice(0, 5)) lines.push(`> “${truncate(quote.value ?? `[${quote.status}]`, 160)}” — ${quote.person ?? 'unnamed'} <${callUrl(campaignId, quote.callId)}>`)
  return truncate(lines.join('\n'))
}

// Notification text for an API event, or null when the event is not worth a message.
export function eventMessage(event: EventRow): string | null {
  const name = event.campaignName ?? 'A campaign'
  const link = event.campaignId ? ` <${campaignUrl(event.campaignId)}>` : ''
  const payload = (event.payload ?? {}) as Record<string, unknown>
  switch (event.type) {
    case 'outreach.started': return `▶️ Calling started for **${name}**.${link}`
    case 'outreach.paused': return `⏸️ Calling paused for **${name}**.${link}`
    case 'outreach.stopped': return `⏹️ **${name}** was stopped.${link}`
    case 'outreach.completed': return `✅ **${name}** finished: nothing left to dial.${link}`
    case 'call.create_failed': return `⚠️ A call for **${name}** could not be placed (${String(payload.code ?? 'error')}).${link}`
    case 'report.generated': return `📄 Report v${String(payload.version ?? '')} is ready for **${name}**.${link}`
    case 'integration.sheets.failed': return `⚠️ Google Sheets update failed for **${name}**: ${String(payload.error ?? 'unknown error')}.${link}`
    case 'integration.calendar.failed': return `⚠️ Google Calendar update failed for **${name}**: ${String(payload.error ?? 'unknown error')}.${link}`
    case 'integration.notion.failed': return `⚠️ Notion publish failed for **${name}**: ${String(payload.error ?? 'unknown error')}.${link}`
    case 'integration.notion.ok': return `📝 Report published to Notion for **${name}**${payload.url ? `: <${String(payload.url)}>` : ''}.`
    case 'contacts.imported': {
      const counts = (payload.counts ?? {}) as Record<string, number>
      return `📇 Contacts imported into **${name}**: ${counts.ready ?? 0} ready, ${counts.invalid ?? 0} invalid, ${counts.duplicate ?? 0} duplicates.${link}`
    }
    case 'webhook.call.completed':
    case 'call.polled': {
      if (payload.outcome === 'callback_requested') return `📞 Someone in **${name}** asked for a callback. Schedule it from the dashboard.${link}`
      if (payload.outcome === 'opted_out') return `🚫 Someone in **${name}** asked never to be called again; they are now on the opt-out list.${link}`
      return null
    }
    default: return null
  }
}
