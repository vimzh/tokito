import { REST, Routes } from 'discord.js'
import { commandDefinition } from './commands'
import { config } from './config'

if (!config.token || !config.appId) {
  console.error('Set DISCORD_TOKEN and DISCORD_APP_ID in apps/discord/.env first.')
  process.exit(1)
}
const rest = new REST().setToken(config.token)
const body = [commandDefinition.toJSON()]
if (config.guildId) await rest.put(Routes.applicationGuildCommands(config.appId, config.guildId), { body })
else await rest.put(Routes.applicationCommands(config.appId), { body })
console.log(`Registered /tokito ${config.guildId ? `in guild ${config.guildId}` : 'globally (may take up to an hour to appear)'}.`)
