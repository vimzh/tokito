# Multi-App AI Agent Hackathon

Checked on September 13, 2026. Official information below is paraphrased from the linked sources. Project proposals are our own planning notes, not organizer requirements. Product scope lives in [idea.md](idea.md).

## Confirmed event requirements

- Build a useful AI agent that performs several steps across at least three external apps, and demonstrate that it works.
- Team size: one to four people.
- Deliver a working project or repository, a two-minute demo, and a short brief explaining the system and its reliability.
- Virtual event: September 13, 2026.

| Pacific time | Activity |
|---|---|
| 9:00 AM | Opening |
| 9:30 AM–4:00 PM | Build |
| 4:00–4:40 PM | Judging and selection |
| 4:40–5:00 PM | Awards |

| Judging category | Weight |
|---|---:|
| Technical execution | 30% |
| Reliability and evaluation | 25% |
| Usefulness | 20% |
| Originality | 15% |
| Demo clarity | 10% |

Prizes: $10,000 first, $4,000 second, $1,000 third. All three winning teams receive guaranteed interviews with Arga Labs or Lemma AI.

Source: [official event website](https://multiappagenthackathon.com/).

## Registration and unresolved rules

The [official registration form](https://docs.google.com/forms/d/e/1FAIpQLSekImCUe5qeXwYA0kFSFrJZ07TneLSJcWplcQaHhshpyQUj-A/viewform) requests name, email, LinkedIn or GitHub profile, school/company and role, and solo/team status. It also includes fields for teammates, the proposed build, and connected apps. A required confirmation covers attendance and integration with at least three external applications. The form includes agreement language for terms and rules.

The website says official rules are available before registration, but the pages inspected did not expose their full text. This document does not establish eligibility or record acceptance of terms. No registration or submission was performed.

Confirm these with the organizers or full rules before relying on them:

- Age, location, and other eligibility restrictions.
- Whether existing code, starter templates, and work begun before the event are allowed.
- What qualifies as a distinct external app, including calling providers.
- Submission destination, exact cutoff, required access, and whether the repository must be public.
- Whether the demo must be recorded or live, and any required brief format.
- Rules governing third-party services, intellectual property, and prize eligibility.

## How our project fits — proposal

Our pitch is **Google Forms, but for phone calls**. A society organizer uploads an Excel file of contacts, tells the agent what to ask, and gets a report from the phone conversations. Discord provides a place to give instructions; the dashboard shows progress and answers.

The agent should complete one connected job: collect the contact list, conduct calls, handle responses or requests to call later, save answers, and prepare a report. A person’s answer should affect what the agent does next.

### Proposed app roles

| App | Useful role in the same job |
|---|---|
| Discord | Receive organizer instructions and answer progress questions. |
| Google Sheets | Read a shared contact list or write results from an uploaded Excel list. |
| Google Calendar | Record requested callback times; the calling system must actually execute the callbacks. |
| Notion | Publish the final report for the society team. |
| Calling provider, to be selected | Place calls and support the spoken conversation. |
| HubSpot or another customer tool | Optional customer context for business outreach; unnecessary for the society example. |

Use Discord, Sheets, Calendar, and Notion as the proposed external-app set, subject to organizer confirmation. Do not rely on counting our own dashboard or a local Excel upload as an external integration. Do not rely on the calling provider counting toward the minimum until that interpretation is confirmed.

These are proposed choices, not a finalized provider commitment. Each connected app should do visible, useful work. The organizer should still be able to start with an Excel file without first maintaining contacts in another service.

## Evidence to prepare — our checklist

The following checks are our proposed way to demonstrate quality; the organizers do not prescribe these exact tests on the pages reviewed.

- Show a real call to a consenting test participant and match their answers to the saved results.
- Show a vague answer leading to a relevant follow-up question.
- Show a request to call later, the saved time, and the eventual callback; a calendar entry alone does not prove completion.
- Verify that repeated notifications or retries do not create duplicate calls or duplicate results.
- Show what happens when a call is unanswered, interrupted, declined, or a connected app fails.
- Verify that an opt-out stops further outreach.
- Check report counts against the contact list and completed calls. Keep unanswered questions and incomplete calls visible.
- Trace report findings back to actual answers. Clearly distinguish quotes, summaries, and suggested actions.
- Record the checks performed and their results, including failures and limitations. Do not present planned checks as passed tests.

## Suggested two-minute demo — our outline

1. Explain the society problem: people forget or ignore feedback forms.
2. Show an Excel contact list and a few event feedback questions.
3. Start the outreach through Discord and show it on the dashboard.
4. Show a phone conversation with a useful follow-up question.
5. Show a callback request moving into Calendar and results moving into Sheets.
6. Show the report in the dashboard and Notion, with evidence behind a finding.
7. End with one demonstrated reliability check and the actual outcome.

Use clearly labeled recordings or prepared examples where necessary to fit the demo length. Do not imply a scheduled future call has already happened.

## Suggested system and reliability brief — our outline

- What the organizer asks for and what the agent completes.
- How Discord, the dashboard, calls, and external apps work together.
- Which decisions the agent makes and which actions the organizer controls.
- How call progress, answers, and callback requests are saved.
- How failures, repeated events, opt-outs, and incomplete answers are handled.
- What was tested, the observed results, and known limitations.

The published schedule is recorded for reference. Product scope should not be reduced solely to fit the event’s build window, as requested by the project owner. Whether pre-event work is allowed remains a separate rules question.
