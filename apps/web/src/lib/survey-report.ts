// Builds a self-contained, script-free report for preview, download, and printing.
import { type Survey, surveyContent } from "../data/surveys";
import { reportReviews, surveyReportContent as copy } from "../data/survey-report";

function escapeHtml(value: string | number) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export function createSurveyReport(survey: Survey) {
  const e = escapeHtml;
  const reviews = reportReviews[survey.id] ?? [];
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(survey.name)} — ${e(copy.title)}</title>
<style>
:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f7f4ed;color:#292722;font:15px/1.7 system-ui,sans-serif}main{max-width:900px;margin:auto;padding:48px 32px}header{padding-bottom:28px;border-bottom:1px solid #d9d3c8}h1{font-size:36px;line-height:1.2;letter-spacing:-1px;margin:12px 0}h2{font-size:22px;margin:0 0 16px}h3{font-size:17px;margin:0 0 12px}p{margin:8px 0;white-space:pre-wrap;overflow-wrap:anywhere}.meta,dt,small{color:#69645c}.notice{background:#eeded0;padding:14px 18px;border-radius:8px}section{margin-top:32px}dl{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:24px 0}dd{margin:4px 0;font-size:28px}dt{font-size:12px}li{padding:0 0 12px 8px;overflow-wrap:anywhere}article{border:1px solid #d9d3c8;border-radius:8px;padding:22px;margin:16px 0;break-inside:avoid}blockquote{margin:12px 0;padding:16px;background:#fffdf8;border-radius:6px}footer{margin-top:40px;padding-top:20px;border-top:1px solid #d9d3c8;font-size:12px}strong{font-weight:600}@media(max-width:560px){main{padding:24px 18px}h1{font-size:28px}dl{grid-template-columns:repeat(2,1fr)}}@media print{@page{size:A4;margin:18mm}body{background:white;color:black;font-size:11pt}main{padding:0;max-width:none}h1{font-size:26pt}h2,h3{break-after:avoid}article{break-inside:auto}blockquote{break-inside:avoid}footer{font-size:9pt}}
</style></head><body><main>
<header><small>Tokito · ${e(copy.title)}</small><h1>${e(survey.name)}</h1><p class="meta">${e(survey.date)} · ${e(survey.status)}</p><p class="notice">${e(surveyContent.demo)}. ${e(survey.status === "Running" ? copy.runningNote : copy.completedNote)}</p></header>
<dl>${surveyContent.metrics.map(({ key, label }) => `<div><dt>${e(label)}</dt><dd>${e(survey[key])}</dd></div>`).join("")}</dl>
<section><h2>${e(copy.agenda)}</h2><p>${e(survey.goal)}</p></section>
<section><h2>${e(copy.summary)}</h2><p>${e(survey.summary)}</p></section>
<section><h2>${e(copy.questions)}</h2>${survey.questions.length ? `<ol>${survey.questions.map((question) => `<li>${e(question)}</li>`).join("")}</ol>` : `<p>${e(copy.emptyQuestions)}</p>`}</section>
<section><h2>${e(copy.feedback)}</h2><p class="meta">${e(surveyContent.responseNote)}</p>${survey.responses.length ? survey.responses.map((response, index) => {
    const review = reviews.find((item) => item.responseIndex === index);
    return `<article><h3>${e(review?.title ?? response.person)}</h3><small>${e(response.person)} · ${e(copy.evidence)}</small><blockquote>${e(response.answer)}</blockquote><p><strong>${e(surveyContent.followUp)}:</strong> ${e(response.followUp)}</p>${review ? `<p><strong>${e(copy.interpretation)}:</strong> ${e(review.interpretation)}</p><p><strong>${e(copy.nextSteps)}:</strong> ${e(review.nextStep)}</p>` : ""}</article>`;
  }).join("") : `<p>${e(copy.emptyResponses)}</p>`}</section>
<footer><strong>${e(copy.limitations)}</strong><p>${e(surveyContent.reportNote)}</p><p>${e(copy.printHint)}</p></footer>
</main></body></html>`;
}
