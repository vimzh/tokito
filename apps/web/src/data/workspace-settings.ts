import { landingContent } from "@/data/landing";

export const connectionsContent = {
  title: "Connections",
  description: "Bring your contacts in. Share what you learn.",
  notice: "Preview only — these integrations are planned and no apps are connected.",
  status: "Not connected",
  action: "Explore connection",
  dialogDescription: "This is a preview of a planned connection. Authorization is not available yet, and no account or data will be connected.",
  close: "Got it",
  items: landingContent.connections.items,
};

export const settingsContent = {
  title: "Settings",
  description: "Defaults for the campaigns you create.",
  section: "Calling defaults",
  sectionDescription: "New campaigns start with these preferences. Each campaign can change its own afterwards.",
  save: "Save defaults",
  saving: "Saving…",
  saved: "Defaults saved. New campaigns will use them.",
};
