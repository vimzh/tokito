export const integrationConfig = {
  publicUrl: (process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3002}`).replace(/\/$/, ''),
  webOrigin: (process.env.WEB_ORIGIN ?? 'http://localhost:3000').replace(/\/$/, ''),
  google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET },
  notion: { clientId: process.env.NOTION_CLIENT_ID, clientSecret: process.env.NOTION_CLIENT_SECRET },
}

export const googleScopes = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/userinfo.email']

export const providerConfigured = (provider: 'google' | 'notion') => Boolean(integrationConfig[provider].clientId && integrationConfig[provider].clientSecret)
export const redirectUri = (provider: 'google' | 'notion') => `${integrationConfig.publicUrl}/api/connections/${provider}/callback`
