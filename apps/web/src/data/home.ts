import { navigationContent } from "@/data/navigation";

export const homeContent = {
  title: "Home",
  description: "A clear view of your conversations, from the first call to the final report.",
  preview: "Demo workspace · sample data",
  running: "Running now",
  history: "Past surveys",
  historyDescription: "Review completed outreach and open a survey to explore its results.",
  progress: "responses collected",
  view: "View survey",
  table: { name: "Survey", date: "Created", targeted: "People targeted", reached: "People reached", completed: "Responses", status: "Status" },
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
