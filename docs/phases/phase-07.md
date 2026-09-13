# Phase 7 — Reports and asking questions of the data

Status: complete, September 13, 2026.

## Outcome

An organizer generates a report from the completed calls and reads what people said, why, where they agree and disagree, what they asked for, what is missing, and what the evidence suggests doing next. Every count is computed from the database. Every theme and every suggestion points at the answers behind it. The organizer can also ask a question in plain language and get an answer with citations, or an honest "not enough evidence".

## Design

- **Evidence pack** (`src/reports/evidence.ts`). Built from `responseCalls` and `answers`: one item per recorded answer with a short id (`e1…eN`), the person, the question, the value, the notes, the call id, and whether it came from a text simulation, plus each call's summary and requests for the organizer. The model only ever sees and cites these ids.
- **Report generation** (`src/reports/generate.ts`). A Strands agent (OpenAI model) receives the goal, the questions, and the evidence pack and returns structured output: a headline, themes (positive, problem, suggestion, other) with evidence ids, disagreements with sides, requests for the organizer, and next steps that name their evidence. Code then validates every id, drops anything unsupported, counts distinct people per theme from the database rows, attaches the quotes, and merges the database-computed participation, per-question results, and gaps (skipped, declined, unknown, not asked, unreachable, callbacks pending). The result is stored as a new version in `reports`; earlier versions stay readable.
- **Ask the report** (`src/reports/ask.ts`). The same evidence pack plus the question; structured output `{ answer, evidence_ids, confidence, not_enough_evidence }`. Citations are resolved to quotes; questions and answers are kept in `report_questions`.
- **Guardrails.** No number in the report comes from the model. Themes without valid evidence are removed. The page labels the model's text as AI summary or AI suggestion, shows quotes as quotes, states how many people were contacted versus answered, and warns that respondents are not automatically representative. Text simulations are counted and labeled.
- **Cleanup.** The Phase 1 sample-data report mockup (`survey-report.tsx`, `data/survey-report.ts`, `lib/survey-report.ts`, `data/surveys.ts`) is removed; nothing referenced it since Phase 1.

## API

- `GET /api/campaigns/:id/report` → latest report (or `null`) and the version list; `?version=n` for an earlier one.
- `POST /api/campaigns/:id/report` → generate a new version (400 when there are no completed calls, 503 without an OpenAI key).
- `POST /api/campaigns/:id/report/ask` `{ question }` → answer with citations; `GET /api/campaigns/:id/report/questions` → history.

## Acceptance checks

1. Every count in a report can be reproduced with a query (covered by tests: theme people counts equal distinct calls among valid evidence; participation equals `campaignResults`).
2. Every quote in a report is a verbatim stored answer and links to its call.
3. Skipped and declined questions appear in the gaps section rather than being smoothed over.
4. A question the evidence cannot answer gets "not enough evidence" rather than an invented answer (prompted; verified live where a key is available).
5. Lint, typecheck, build, and API tests pass.

## Completion note

**What changed.** Built as designed. Notes:

- The model never sees answer ids; it cites short evidence ids (`e1…eN`) that code maps back to `answerId` and `callId`. Citations that do not resolve are dropped and counted (`droppedCitations`), and the page says so.
- People counts per theme are distinct contacts (or distinct calls for detached simulations) among the resolved evidence, computed in code.
- Gaps are computed from `campaignResults` status counts plus outreach counts (unreachable, callbacks pending, declined); the model has no say in them.
- Quotes carry the answer status, so a cited skipped or not-asked answer renders as a labeled gap rather than an empty quote.
- The Phase 1 sample-data report mockup and `data/surveys.ts` were removed; nothing referenced them.

**Live run (2026-09-13, `gpt-5.5`, "New menu feedback" campaign with two simulated responses).** Report generated in 10.5 s with zero dropped citations. Headline stated plainly that the responses were text simulations. Themes: "Price felt high" (problem, 1 person, cites "It felt expensive."), "New menu not yet tried" (other), "Some exposure to pasta and paneer item" (other). Gaps listed the skipped portion question and the not-asked dish questions. Three next steps, each citing evidence. Asked "Are the price complaints about the price itself or the portion size?": answered that the portion comparison was skipped or not asked, so the evidence cannot separate the two, flagged not enough evidence, cited the relevant answers. Asked about desserts: said no dessert feedback was recorded, flagged not enough evidence.

**Checks run.**

| Check | Result |
|---|---|
| `bun run lint`, `bun run typecheck`, `bun run build` | Pass |
| `bun test` in `apps/api` (48 tests; 5 new: evidence pack ids and rendering, citation validation with distinct people counts and database gaps, versioning, refusal without completed calls, ask with citations and the not-enough-evidence path) | Pass |
| Live generation and two live questions (above) | Pass |
| HTTP session: Report tab payload carries the version line, AI summary labels, the theme with its people count and Open call links, Gaps, AI-labeled next steps, the stored ask history, and the simulations note. The Generate and Ask controls are client components whose labels are not in the server payload | Pass |
| Browser click-through of Generate and Ask | Not run: needs a logged-in browser session |

**What the next phase should know.** Discord (Phase 8) can call `POST /report`, `GET /report`, and `POST /report/ask` directly and render `headline`, theme titles with people counts, and quotes with call links to the dashboard. Notion (Phase 9) publishes `ReportContent`; keep quotes as quotes and keep the AI labels.


## Addendum (September 13, 2026): multi-agent report pipeline

At the user's request the report is now written by several specialized agents instead of one, in `src/reports/pipeline.ts`:

1. **Analyst agents**, one per question with at least one recorded answer, run in parallel at low reasoning effort. Each sees only its question's answers and returns findings (with evidence ids), an optional disagreement, requests, and a coverage note.
2. **Synthesis agent** receives the full evidence list plus every analyst's findings and produces the report structure (headline, cross-question themes, disagreements, requests, next steps), citing evidence ids.
3. **Reviewer agent** checks the draft against the evidence: it marks themes, disagreements, requests, and next steps as supported or not, lists citations that do not support a theme, and rewrites a headline that claims too much. Code applies the verdicts (`applyReview`): unsupported items are removed, rejected citations trimmed, the headline replaced.
4. The existing code-side validation (`assembleReport`) then resolves ids, counts distinct people, and merges the database-computed participation, per-question results, and gaps as before.

The stored report carries `pipeline` metadata (number of analysts, models, and reviewer statistics) and `promptVersion = report-v2-multiagent`; the page shows a one-line account of what the reviewer removed. The single-agent path remains available as `generateReport(..., { mode: 'single' })` for comparison. Ask-the-report is unchanged (single agent over the same evidence).

**Checks.** A pipeline test drives all three stages with a fake model: it asserts one analyst per question receiving only that question's answers, the synthesis prompt carrying the analysts' findings, the reviewer's verdicts removing an invented theme and an unrelated next step, trimming a weak citation, and rewriting an overreaching headline, and the stored report recording the statistics. `bun test` (59) passes. A live run on 2026-09-13 could not complete: the OpenAI organization's spend limit was reached (`enforced spend limit`). Rerun `generateReport` on the "New menu feedback" campaign once the limit is raised and record the timing and reviewer statistics here.
