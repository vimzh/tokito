// Report labels and illustrative reviews grounded in the shared sample responses.
export const surveyReportContent = {
  title: "Survey report",
  download: "Download HTML report",
  printHint: "Download the HTML report and open it in your browser. To save a PDF, choose Print, then Save as PDF.",
  summary: "Summary",
  agenda: "Survey agenda",
  questions: "Questions asked",
  feedback: "Sample feedback reviews",
  interpretation: "Example interpretation · Paraphrase",
  nextSteps: "Suggested next steps",
  evidence: "Illustrative response",
  limitations: "All figures and responses are sample data. These examples are not real call findings or representative of all participants. Interpretations are paraphrases; suggested actions have not been validated.",
  emptyResponses: "No sample responses are available for this survey.",
  emptyQuestions: "No questions are listed for this survey.",
  runningNote: "This sample survey is marked Running. Its report is illustrative and does not show live call results.",
  completedNote: "This sample survey is marked Completed. No real calls have been made or responses collected.",
};

export const reportReviews: Record<string, {
  title: string;
  responseIndex: number;
  interpretation: string;
  nextStep: string;
}[]> = {
  "new-menu-feedback": [
    {
      title: "Vegetarian variety",
      responseIndex: 0,
      interpretation: "Paraphrase: This sample participant enjoyed the pasta and wanted another vegetarian main.",
      nextStep: "Suggestion: Ask which vegetarian dishes they would like before considering a menu addition.",
    },
    {
      title: "Portion expectations",
      responseIndex: 1,
      interpretation: "Paraphrase: This sample participant liked the food but expected a larger portion for the price.",
      nextStep: "Suggestion: Identify the dish and expected portion before reviewing portion sizes or menu descriptions.",
    },
  ],
  "society-event-feedback": [
    {
      title: "Discussion time",
      responseIndex: 0,
      interpretation: "Paraphrase: This sample participant valued the open discussion and wanted more time for it.",
      nextStep: "Suggestion: Ask which topics needed more time when planning the next event agenda.",
    },
    {
      title: "Hearing from the back",
      responseIndex: 1,
      interpretation: "Paraphrase: This sample participant had difficulty hearing from the back of the room.",
      nextStep: "Suggestion: Clarify when the difficulty occurred and check audibility from the back before the next event.",
    },
  ],
  "workshop-check-in": [
    {
      title: "Learning through practice",
      responseIndex: 0,
      interpretation: "Paraphrase: Working through the exercise helped this sample participant understand the material.",
      nextStep: "Suggestion: Ask what became clearer to identify which parts of the exercise were useful.",
    },
    {
      title: "Time for the final task",
      responseIndex: 1,
      interpretation: "Paraphrase: This sample participant needed more time on the last task.",
      nextStep: "Suggestion: Ask which step needs another explanation before planning follow-up practice.",
    },
  ],
};
