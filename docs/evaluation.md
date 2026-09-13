# Evaluation record

What was checked, how, and what happened. Written September 13, 2026. Automated tests: 64 in `apps/api`, 9 in `apps/discord` (`bun test`). End-to-end runs with synthetic transcripts: `docs/evaluation/run-*.md` (produced by `apps/api/scripts/eval.ts`).

Nothing here was run against CALL-E, a real Discord server, or real Google or Notion accounts; those paths are covered by tests against fakes and are marked as such.

## The checklist from `hackathon.md`

| Check | How it was verified | Result |
|---|---|---|
| A real call to a consenting participant whose answers match the saved results | Not possible without a CALL-E key. The equivalent text path was run: an LLM plays the person in the text simulator; the stored answers were compared with the transcript in five scenarios (`docs/evaluation/`). CALL-E result mapping is tested with the provider's published payload shapes (`scheduler.test.ts`). | Text path: pass in all scenarios. Live call: **not run**. |
| A vague answer leads to a relevant follow-up | Simulated calls with a deliberately vague persona in dynamic mode, follow-ups counted by a classifier and read by hand. | Pass after a fix: the first run produced no follow-ups with eight questions; the dynamic rule in the call script was strengthened, after which the vague persona received 4 follow-ups ("What made the paneer tikka pasta really good for you?", "What made it a four for you?"). Fixed mode: 0 follow-ups. |
| A request to call later, the saved time, and the eventual callback | `scheduler.test.ts`: a `callback_requested` result stores the person's words; the organizer schedules a time; the queued call is dialed at that time even outside calling hours; a calendar event is created and later marked done (`integrations.test.ts`). | Pass (fake provider and fake Google API). Live callback: **not run**. |
| Repeated notifications or retries do not create duplicate calls or results | `scheduler.test.ts`: the same webhook event delivered twice is acknowledged as duplicate and changes nothing; a contact with an active call is never dialed again; call creation carries an idempotency key. | Pass. |
| Unanswered, interrupted, declined calls and a connected-app failure | `scheduler.test.ts` (no-answer retry after the delay, then unreachable at the attempt limit; `unsupported_region` recorded on the call and contact; declined status), `integrations.test.ts` (Sheets permission error, Calendar 401, Notion 404 all recorded as failed with the message visible). | Pass. |
| An opt-out stops further outreach | `contacts.test.ts` (listed numbers can never become ready, even through an edit), `scheduler.test.ts` (an opt-out during a call lands on the list and marks the contact). | Pass. |
| Report counts match the contact list and completed calls; unanswered questions and incomplete calls stay visible | `results.test.ts` against a fixture with a re-called person, a decliner, an unreachable person, and a simulation; the evaluation harness re-checks every run: status counts per question sum to the responses, theme people counts never exceed responses, every quote carries a call and answer id. Gaps are listed per question in the report. | Pass in tests and in every evaluation scenario (deterministic checks: all passed). |
| Report findings trace back to actual answers; quotes, summaries, and suggestions are distinguished | `reports.test.ts` (citations that do not resolve are dropped and counted; quotes carry answer and call ids); the multi-agent reviewer removes unsupported claims; the page labels AI summary and AI suggestion and links every quote to its call. Evaluation runs report dropped citations (0 in all scenarios) and reviewer statistics. | Pass. |
| Record the checks performed and their results, including failures | This file and `docs/evaluation/run-*.md`. | Done. |

## End-to-end runs (no CALL-E)

Two runs were made on September 13, 2026. The first (`run-2026-09-13-08-34`, restaurant scenario only) exposed three problems, fixed before the second: no follow-ups in dynamic mode, "no conversation" outcomes counted as completed responses, and a judge that saw only a sample and wrongly called real quotes fabricated. The second run (`run-2026-09-13-09-11`) covers five scenarios with the fixes. Per-scenario details, transcripts, judge scores, and token usage are in those files. Summary:

| Scenario | Question judge (relevance / not leading / screening / spoken / length) | Follow-ups in dynamic calls | Follow-ups in fixed calls | Responses | Themes | Reviewer agent | Dropped citations | Report judge (faithful / coverage / useful / honest / headline) | Report time |
|---|---|---|---|---:|---:|---|---:|---|---|
| New menu feedback | 5/5/5/5/5 | Priya 4, Rahul 0 | Sunita 0 | 54 | 7 | 4 removed, 1 trimmed | 0 | 4/4/4/4/5 | 119 s |
| Society event feedback | 5/5/5/5/5 | Asha 1, Ravi 0 | Meera 0 | 56 | 8 | 0 removed, 0 trimmed | 0 | 5/5/5/4/5 | 84 s |
| New onboarding flow feedback | 5/5/5/4/5 | Dev 1, Lena 2 | Tomás 0 | 53 | 7 | 2 removed, 0 trimmed | 0 | 4/5/5/4/5 | 92 s |
| New front-desk team feedback | 5/5/4/5/5 | Kavya 2, Arjun 3 | Farah 0 | 57 | 6 | 2 removed, 0 trimmed | 0 | 4/4/4/4/5 | 88 s |
| Volunteer availability and support | 5/5/5/5/5 | Nikhil 1, Sara 0 | Imran 0 | 53 | 7 | 1 removed, 4 trimmed | 0 | 4/4/5/3/4 | 111 s |

All 15 simulated calls behaved as designed: people who had not had the experience were screened out (Rahul, Farah, Dev), a callback request was recorded with the person's words (Arjun: "next week"), an opt-out ended the call in three turns and was recorded (Sara), a refusal was stored as declined, and fixed mode never added a follow-up. Every question set scored 5/5 on relevance and non-leading wording; the questions included a screening question in every scenario. Ask-the-report answered ten questions with citations, including one it correctly declined to answer ("better or worse than the old team": no old-team evidence).

Judge remarks worth acting on, and what was done:

- People counts on themes read as understated because they count only the answers the synthesis agent cited. Labels now say "cited from N people" and the page explains it.
- A theme was built from screening yes/no answers (restaurant, volunteers). The synthesis agent is now told to treat screening answers as context. Validated in the rerun below.
- Next steps sometimes skipped the largest problem theme (clinic). The synthesis agent must now give every major problem theme a next step. Validated in the rerun below.
- The participation numbers versus response counts (responses include text simulations without a contact) confused the judge, who did not see the dashboard's explanatory note. The page, the Notion export, and Discord all carry that note.

Token usage for the five-scenario run: gpt-5.5 931,184 tokens over 225 calls (805,403 in, 125,781 out); gpt-5.4-nano 10,830,201 tokens over 176 calls, almost all of it generating the synthetic people. A real campaign of 80 responses uses roughly 100,000 gpt-5.5 tokens for drafting, the report pipeline, and two questions; the nano usage exists only to fabricate test data.

### Validation rerun (`run-2026-09-13-10-29`, restaurant scenario)

Run after the last two synthesis changes. Seven themes, none built from screening answers; six next steps, one for every problem theme; the reviewer removed one claim; zero dropped citations; dynamic calls received 2 and 1 follow-ups, the fixed call none; judge 4 / 5 / 5 / 4 / 4. The judge's remaining objections concern participation figures it was not given (they come from the database, not the answers) and quote selection where a quote names a dish without the sentiment that sits in the person's notes. Scenario time 9.5 minutes; gpt-5.5 200,485 tokens including the simulations and the judge.

## Known limitations

- Synthetic people are generated by a small model, so bulk answers are more uniform than real customers; the simulated calls (an LLM in character) are the better test of conversation behaviour.
- The LLM judge is one opinion; scores are indicative. Deterministic checks (citations resolve, counts reconcile) are the hard guarantees.
- Costs: see the token table in each run file; prices depend on the OpenAI plan.
