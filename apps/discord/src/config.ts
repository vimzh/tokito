export const config = {
  token: process.env.DISCORD_TOKEN,
  appId: process.env.DISCORD_APP_ID,
  guildId: process.env.DISCORD_GUILD_ID,
  apiUrl: process.env.API_URL ?? 'http://localhost:3002',
  dashboardUrl: (process.env.DASHBOARD_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  openaiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL ?? 'gpt-5.5',
  pollSeconds: Number(process.env.NOTIFY_POLL_SECONDS ?? 30),
  confirmMinutes: 10,
}

export const campaignUrl = (id: string) => `${config.dashboardUrl}/survey/${id}`
export const callUrl = (campaignId: string, callId: string) => `${config.dashboardUrl}/survey/${campaignId}/calls/${callId}`
