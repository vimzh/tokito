
export const connectionsContent = {
  title: "Connections",
  description: "Bring your contacts in. Share what you learn.",
  intro: "Connect an account once here, then choose per campaign which sheet or page to use.",
  providers: {
    google: { title: "Google", description: "Google Sheets as a contact source and a live results sheet; Google Calendar entries for callbacks." },
    notion: { title: "Notion", description: "Publish each report as a page where your team keeps its documents." },
  },
  connected: (label: string | null) => (label ? `Connected as ${label}` : "Connected"),
  notConnected: "Not connected",
  notConfigured: "Not available: the API has no client id and secret for this provider.",
  connect: "Connect",
  disconnect: "Disconnect",
  disconnecting: "Disconnecting…",
  justConnected: (provider: string) => `${provider} connected.`,
  connectFailed: (error: string) => `Connection failed: ${error}`,
  planned: "Not available yet: Slack, HubSpot, Gmail, Linear.",
};

export const settingsContent = {
  title: "Settings",
  description: "Defaults for the campaigns you create.",
  section: "Calling defaults",
  sectionDescription: "New campaigns start with these preferences. Each campaign can change its own afterwards.",
  retention: "Delete collected data after (days)",
  retentionHint: "Applies to completed campaigns: contacts, transcripts, and answers are deleted this many days after the campaign ends. Leave empty to keep data until you delete it yourself. Reports and counts stay.",
  save: "Save defaults",
  saving: "Saving…",
  saved: "Defaults saved. New campaigns will use them.",
  optOuts: {
    title: "Opt-out list",
    description: "Numbers that must never be called. Matching contacts in every campaign are marked opted out.",
    phone: "Phone number",
    reason: "Reason (optional)",
    add: "Add to opt-out list",
    adding: "Adding…",
    remove: "Remove",
    empty: "No numbers on the list.",
    added: "Added",
  },
};
