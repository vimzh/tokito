import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Client, Events, GatewayIntentBits, Partials, type Interaction, type Message } from 'discord.js'
import { createApi, ApiError } from './api'
import { runAgent } from './agent'
import { handleCommand } from './commands'
import { config } from './config'
import { Confirmations, executePending, type Pending } from './confirmations'
import { chunk } from './format'
import { startNotifier } from './notifications'

if (!config.token || !config.appId) {
  console.log('Discord bot not started: set DISCORD_TOKEN and DISCORD_APP_ID in apps/discord/.env.')
  process.exit(0)
}

const api = createApi(config.apiUrl)
const confirmations = new Confirmations()
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages], partials: [Partials.Channel] })

const buttons = (pending: Pending) =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`confirm:${pending.id}`).setLabel('Confirm').setStyle(pending.kind === 'stop' || pending.kind === 'delete' ? ButtonStyle.Danger : ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`cancel:${pending.id}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
  )

const errorText = (error: unknown) => (error instanceof ApiError ? error.message : 'Something went wrong talking to Tokito. Check that the API is running.')

client.once(Events.ClientReady, (ready) => {
  console.log(`Tokito Discord bot ready as ${ready.user.tag}`)
  startNotifier(
    api,
    async (channelId, text) => {
      const channel = await client.channels.fetch(channelId).catch(() => null)
      if (channel && channel.isSendable()) await channel.send(text)
    },
    config.pollSeconds,
  )
})

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === 'tokito') {
    await interaction.deferReply()
    try {
      const reply = await handleCommand(api, confirmations, {
        subcommand: interaction.options.getSubcommand(),
        options: { campaign: interaction.options.getString('campaign') ?? undefined, question: interaction.options.getString('question') ?? undefined, generate: interaction.options.getBoolean('generate') ?? undefined },
        userId: interaction.user.id,
        username: interaction.user.username,
        channelId: interaction.channelId,
      })
      const [first, ...rest] = chunk(reply.text)
      await interaction.editReply({ content: first, components: reply.pending ? [buttons(reply.pending)] : [] })
      for (const part of rest) await interaction.followUp(part)
    } catch (error) {
      await interaction.editReply(errorText(error))
    }
    return
  }
  if (interaction.isButton()) {
    const [action, id] = interaction.customId.split(':')
    if (!id || (action !== 'confirm' && action !== 'cancel')) return
    if (action === 'cancel') {
      const pending = confirmations.get(id)
      if (pending && pending.userId !== interaction.user.id) return void interaction.reply({ content: 'Only the person who asked can cancel this.', ephemeral: true })
      confirmations.cancel(id)
      return void interaction.update({ content: 'Cancelled. Nothing was changed.', components: [] })
    }
    const taken = confirmations.take(id, interaction.user.id)
    if (!taken.ok) {
      const reasons = { unknown: 'This confirmation is no longer available.', expired: 'This confirmation expired. Ask again.', not_yours: 'Only the person who asked can confirm this.' }
      return void interaction.reply({ content: reasons[taken.reason], ephemeral: true })
    }
    try {
      await interaction.update({ content: await executePending(api, taken.pending), components: [] })
    } catch (error) {
      await interaction.update({ content: errorText(error), components: [] })
    }
  }
})

client.on(Events.MessageCreate, async (message: Message) => {
  if (message.author.bot) return
  const isDm = message.channel.type === ChannelType.DM
  const mentioned = client.user ? message.mentions.has(client.user) : false
  if (!isDm && !mentioned) return
  const text = message.content.replace(/<@!?\d+>/g, '').trim() || 'Hello'
  const ctx = { api, confirmations, userId: message.author.id, username: message.author.username, channelId: message.channelId, attachments: message.attachments.map((a) => ({ name: a.name, url: a.url })), created: [] as Pending[] }
  if (message.channel.isSendable()) await message.channel.sendTyping().catch(() => undefined)
  try {
    const reply = await runAgent(text, ctx)
    const [first, ...rest] = chunk(reply)
    await message.reply({ content: first, components: ctx.created.map(buttons) })
    for (const part of rest) if (message.channel.isSendable()) await message.channel.send(part)
  } catch (error) {
    await message.reply(error instanceof Error ? error.message : 'Something went wrong.')
  }
})

client.login(config.token)
