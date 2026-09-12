// Illustrative survey records shared by the dashboard and detail mockups.
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

export const surveys: Survey[] = [
  {
    id: "new-menu-feedback", name: "New menu feedback", date: "12 Sep 2026", status: "Running",
    targeted: 120, reached: 76, completed: 64, callbacks: 8,
    goal: "Understand what customers think of our new menu, including choices, portions, and prices.",
    questions: ["Which dishes have you tried from the new menu?", "What did you enjoy, and what would you change?", "How did the portion size and price compare with your expectations?"],
    summary: "This example report explores menu variety and value for money. The sample conversations below show two different preferences: more vegetarian choices and clearer portion sizes. These examples are not findings from real calls or representative of all customers.",
    responses: [
      { person: "Sample participant 01", answer: "I liked the pasta, but I would love another vegetarian main.", followUp: "What kind of vegetarian dish would you like to see?" },
      { person: "Sample participant 02", answer: "The food was good. I expected a bigger portion for the price.", followUp: "Which dish did you order, and what portion were you expecting?" },
    ],
  },
  {
    id: "society-event-feedback", name: "Society event feedback", date: "09 Sep 2026", status: "Completed",
    targeted: 80, reached: 68, completed: 60, callbacks: 3,
    goal: "Learn what members enjoyed about our last event and what would make the next one better.",
    questions: ["What was the most useful part of the event?", "Was anything difficult or confusing?", "What would you like us to organize next?"],
    summary: "The illustrative responses point to a useful discussion session and difficulty hearing from the back of the room. One possible next step is to review the room setup before the next event. This is an example interpretation, not an actual event report.",
    responses: [
      { person: "Sample participant 01", answer: "The open discussion was the best part. I wanted more time for it.", followUp: "Which topic would you have liked more time to discuss?" },
      { person: "Sample participant 02", answer: "I could not hear very well from the back.", followUp: "Was that throughout the event or during a particular session?" },
    ],
  },
  {
    id: "workshop-check-in", name: "Workshop check-in", date: "05 Sep 2026", status: "Completed",
    targeted: 45, reached: 39, completed: 35, callbacks: 2,
    goal: "Find out which workshop topics helped participants and where they need more explanation.",
    questions: ["Which part of the workshop was most useful?", "Where would you like more explanation?", "How do you plan to use what you learned?"],
    summary: "In this example, participants value hands-on exercises and ask for more time with the final task. A suggested next step is a short follow-up practice session. No real participant answers have been collected.",
    responses: [
      { person: "Sample participant 01", answer: "Working through the exercise helped me understand it.", followUp: "What became clearer once you tried it yourself?" },
      { person: "Sample participant 02", answer: "I needed more time on the last task.", followUp: "Which step would you like us to explain again?" },
    ],
  },
];

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
