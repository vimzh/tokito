export const landingContent = {
  connections: {
    title: "Your campaign, connected.",
    description: "Planned integrations to bring your contacts, conversations, and reports together.",
    items: [
      { title: "Discord", description: "Give Tokito your campaign instructions, check call progress, and ask what people said—all from your team’s server." },
      { title: "Slack", description: "Start surveys, get progress updates, and discuss the findings with Tokito in your team’s Slack workspace." },
      { title: "Google Sheets", description: "Use a shared sheet as your contact list, then write answers and call statuses back to it." },
      { title: "Google Calendar", description: "Keep agreed callback times and human follow-up appointments on your calendar." },
      { title: "Notion", description: "Publish the final report with key themes, supporting answers, and suggested next steps for your team to review." },
      { title: "HubSpot", description: "Use customer context to inform the questions, then save feedback and follow-up requests to customer records." },
    ],
  },
  useCases: {
    title: "Who do you want to hear from?",
    description: "One way to collect answers. Plenty of reasons to ask.",
    items: [
      { title: "Small businesses", description: "Get customer feedback on a new menu, a service, or a change. Understand what people liked and what needs work." },
      { title: "Societies and clubs", description: "Ask members about activities, preferences, and upcoming plans. Give everyone a chance to weigh in." },
      { title: "Event organizers", description: "Hear what attendees thought of the sessions and arrangements, and what they would change next time." },
      { title: "Product teams", description: "Find out how people use a new feature, where they get stuck, and what they still need." },
      { title: "Customer service teams", description: "Follow up after a service visit to learn whether the problem was resolved and what still needs attention." },
      { title: "Educators and trainers", description: "Ask participants which topics were useful, what was unclear, and what they want to learn next." },
      { title: "Nonprofits and volunteers", description: "Collect availability, preferred roles, and support needs to help coordinate your next activity." },
      { title: "Community groups", description: "Hear residents’ concerns and priorities for shared spaces, facilities, and neighborhood improvements." },
      { title: "Researchers and creators", description: "Explore how people handle a problem today, with real examples and follow-up questions that uncover the details." },
    ],
  },
  features: {
    title: "From a question to a clearer picture.",
    description: "Describe what you want to learn, upload your contacts, and review the questions. Tokito calls people, follows the conversation, and brings their answers together in a report.",
    items: [
      { title: "Start with a prompt", description: "Explain your goal in your own words. Review and edit the questions Tokito drafts before starting your campaign." },
      { title: "Bring your contact list", description: "Upload an Excel file and check your contacts before outreach begins." },
      { title: "Go beyond the first answer", description: "Relevant follow-up questions help uncover the reasons and examples behind a response." },
      { title: "Follow every call", description: "See who answered, who completed the questions, and who requested a callback." },
      { title: "Read the full story", description: "Explore detailed reports with recurring themes, differing opinions, and the answers behind each finding." },
      { title: "Work from Slack, Discord, or the web", description: "Manage campaigns, check progress, and ask questions about responses wherever your team works." },
    ],
  },
  hero: {
    description:
      "Tell Tokito what you want to learn and upload your contact list. It drafts the questions, calls people, asks thoughtful follow-ups, and turns their answers into a detailed report.",
    primaryAction: {
      href: "/home",
      label: "Create a campaign",
    },
    secondaryAction: {
      label: "See demo",
    },
    title: "Google Forms, but for phone calls.",
  },
} as const;
