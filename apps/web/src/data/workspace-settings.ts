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
  description: "A few defaults for the conversations you create.",
  notice: "Preview only — changes reset on reload.",
  section: "Calling preferences",
  sectionDescription: "Sample defaults for new surveys. These settings do not start or schedule calls.",
  language: "Conversation language",
  languages: ["English", "Hindi"],
  duration: "Maximum call length",
  durations: [{ value: "3", label: "3 minutes" }, { value: "5", label: "5 minutes" }, { value: "10", label: "10 minutes" }],
  start: "Calling hours start",
  end: "Calling hours end",
  timezone: "Sample time zone: Asia/Kolkata (IST).",
  save: "Save preview",
  saved: "Preview saved for this page. Changes reset on reload.",
  invalidHours: "Choose an end time later than the start time.",
  defaults: { language: "English", duration: "5", start: "10:00", end: "18:00" },
};
