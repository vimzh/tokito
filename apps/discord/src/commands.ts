import { SlashCommandBuilder } from 'discord.js'
import { resolveCampaign, type Api } from './api'
import { Confirmations, describeAction, type Pending, type PendingKind } from './confirmations'
import { askMessage, campaignList, reportMessage, statusMessage } from './format'

export const commandDefinition = new SlashCommandBuilder()
  .setName('tokito')
  .setDescription('Manage Tokito phone campaigns')
  .addSubcommand((s) => s.setName('help').setDescription('What Tokito can do here'))
  .addSubcommand((s) => s.setName('campaigns').setDescription('List campaigns'))
  .addSubcommand((s) => s.setName('status').setDescription('Progress of a campaign').addStringOption((o) => o.setName('campaign').setDescription('Campaign name or id').setRequired(true)))
  .addSubcommand((s) => s.setName('start').setDescription('Start or resume calling (asks for confirmation)').addStringOption((o) => o.setName('campaign').setDescription('Campaign name or id').setRequired(true)))
  .addSubcommand((s) => s.setName('pause').setDescription('Pause calling (asks for confirmation)').addStringOption((o) => o.setName('campaign').setDescription('Campaign name or id').setRequired(true)))
  .addSubcommand((s) => s.setName('stop').setDescription('Stop a campaign for good (asks for confirmation)').addStringOption((o) => o.setName('campaign').setDescription('Campaign name or id').setRequired(true)))
  .addSubcommand((s) => s.setName('report').setDescription('Show the latest report').addStringOption((o) => o.setName('campaign').setDescription('Campaign name or id').setRequired(true)).addBooleanOption((o) => o.setName('generate').setDescription('Generate a new version')))
  .addSubcommand((s) => s.setName('ask').setDescription('Ask what people said').addStringOption((o) => o.setName('campaign').setDescription('Campaign name or id').setRequired(true)).addStringOption((o) => o.setName('question').setDescription('Your question').setRequired(true)))
  .addSubcommand((s) => s.setName('link').setDescription('Send Tokito notifications to this channel'))

export const helpText = [
  '**Tokito in Discord**',
  '`/tokito campaigns` list campaigns · `/tokito status <campaign>` progress',
  '`/tokito start|pause|stop <campaign>` change calling (you confirm with a button)',
  '`/tokito report <campaign>` latest report · `/tokito ask <campaign> <question>` ask what people said',
  '`/tokito link` send notifications to this channel',
  'Or mention me: "create a campaign about our new menu", "draft questions for Menu feedback", attach a spreadsheet and say "import these into Menu feedback", "how is Menu feedback going?"',
].join('\n')

export type CommandInput = { subcommand: string; options: Record<string, string | boolean | undefined>; userId: string; username: string; channelId: string }
export type CommandReply = { text: string; pending?: Pending }

// Pure handler for slash commands so it can be tested without Discord.
export async function handleCommand(api: Api, confirmations: Confirmations, input: CommandInput): Promise<CommandReply> {
  const ref = String(input.options.campaign ?? '')
  const propose = async (kind: PendingKind) => {
    const campaign = await resolveCampaign(api, ref)
    const pending = confirmations.create({ kind, campaignId: campaign.id, campaignName: campaign.name, userId: input.userId, username: input.username, description: describeAction(kind, campaign.name) })
    return { text: `${pending.description}\nPress **Confirm** to go ahead.`, pending }
  }
  switch (input.subcommand) {
    case 'help': return { text: helpText }
    case 'campaigns': return { text: campaignList(await api.listCampaigns()) }
    case 'status': {
      const summary = await resolveCampaign(api, ref)
      const [campaign, outreach, results] = await Promise.all([api.getCampaign(summary.id), api.getOutreach(summary.id), api.getResults(summary.id)])
      return { text: statusMessage(campaign, outreach, results) }
    }
    case 'start': return propose('start')
    case 'pause': return propose('pause')
    case 'stop': return propose('stop')
    case 'report': {
      const summary = await resolveCampaign(api, ref)
      const existing = await api.getReport(summary.id)
      if (!existing.report || input.options.generate === true) {
        const report = await api.generateReport(summary.id)
        return { text: reportMessage(summary.id, report.content, report.version) }
      }
      return { text: reportMessage(summary.id, existing.report.content, existing.report.version) }
    }
    case 'ask': {
      const summary = await resolveCampaign(api, ref)
      return { text: askMessage(summary.id, await api.askReport(summary.id, String(input.options.question ?? ''))) }
    }
    case 'link':
      await api.updateSettings({ discordChannelId: input.channelId })
      return { text: 'This channel now receives Tokito notifications.' }
    default: return { text: helpText }
  }
}
