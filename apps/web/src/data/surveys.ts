// Survey view model used by the report mockup (src/lib/survey-report.ts). Real campaigns live in src/lib/api.ts.
export type Survey = {
  id: string;
  name: string;
  date: string;
  status: "Running" | "Completed";
  targeted: number;
  reached: number;
  completed: number;
  callbacks: number;
  goal: string;
  questions: string[];
  summary: string;
  responses: { person: string; answer: string; followUp: string }[];
};

export const surveyContent = {
  back: "All surveys", demo: "Sample survey · No calls have been made",
  metrics: [{ key: "targeted", label: "People in list" }, { key: "reached", label: "People reached" }, { key: "completed", label: "Completed responses" }, { key: "callbacks", label: "Callback requests" }] as const,
  overview: "Overview", responses: "Responses", report: "Report", goal: "What we want to learn", questions: "Questions",
  responseNote: "Two illustrative conversations. These are examples, not the full response list.",
  answer: "Example answer", followUp: "Follow-up question", reportTitle: "Example report",
  reportNote: "All figures and responses on this page are sample data. Callback requests are not scheduled appointments.",
  create: "Create Survey", description: "Tell Tokito what you want to learn. This mockup previews your brief only; it does not save a survey or make calls.",
  name: "Survey name", namePlaceholder: "New menu feedback", prompt: "What do you want to learn?", promptPlaceholder: "We changed our menu. Find out what customers like and what we could improve.",
  preview: "Preview survey", previewTitle: "Review your brief", previewNote: "Preview only. Questions, contact uploads, and calling preferences will come next in the full product.",
  edit: "Edit brief", close: "Close preview", invalid: "Enter a survey name and a goal with at least one non-space character.",
};
