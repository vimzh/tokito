// Run with bun scripts/check-survey-report.ts.
import assert from "node:assert/strict";
import { surveys } from "../apps/web/src/data/surveys";
import { createSurveyReport } from "../apps/web/src/lib/survey-report";

for (const survey of surveys) {
  const html = createSurveyReport(survey);
  assert(html.startsWith("<!doctype html>"));
  assert(html.includes(survey.goal));
  assert(html.includes(survey.questions[0]));
  assert(html.includes(survey.responses[0].answer));
  assert(html.includes("@media print"));
  assert(!/<script|<link|<img/i.test(html));
}
const unsafe = createSurveyReport({ ...surveys[0], id: "unknown", name: '<script>alert("x")</script>', goal: "A & B", questions: [], responses: [] });
assert(!unsafe.includes("<script>"));
assert(unsafe.includes("&lt;script&gt;"));
assert(unsafe.includes("A &amp; B"));
assert(!unsafe.includes("undefined"));
console.log("Passed: campaign-specific reports, HTML escaping, empty content, offline output, and print styles.");
