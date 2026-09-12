import { navigationContent } from "@/data/navigation";

export const homeContent = {
  title: "Home",
  description: "A clear view of your conversations, from the first call to the final report.",
  create: "Create campaign",
  running: "Running now",
  all: "All campaigns",
  allDescription: "Open a campaign to review its goal and questions.",
  view: "View campaign",
  table: { name: "Campaign", date: "Created", questions: "Questions", status: "Status" },
  empty: {
    title: "No campaigns yet",
    description: "Describe what you want to learn and Tokito will help you ask it.",
  },
  navigation: [
    { href: "/home", label: "Home" },
    { href: "/connections", label: "Connections" },
    { href: "/settings", label: "Settings" },
  ],
  sidebar: {
    brand: navigationContent.brand,
    home: {
      href: "/home",
      label: "Home",
    },
    label: "Workspace navigation",
    profile: {
      accountLabel: "Account",
      signedInLabel: "Signed in",
      signedOutLabel: "Not signed in",
    },
  },
} as const;
