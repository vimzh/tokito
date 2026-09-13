# Two-minute demo script

Prepare: `bun run setup`, then `cd apps/api && bun run db:demo` to seed "Society event feedback (demo)" with five contact rows (one blank number, one duplicate) and two finished text simulations. Start the API and the web app; log in with the demo account. If CALL-E, Discord, Google, or Notion credentials are configured, the corresponding steps become live; otherwise use the labeled text simulations and say so.

| Time | Show | Say |
|---|---|---|
| 0:00 | Landing page, then Home | "Society organizers chase people for feedback forms. Tokito calls them instead and reports what they said." |
| 0:15 | Campaign page, Overview: goal, background, questions | "The organizer describes the goal. Tokito drafts the questions; she edits them here. Each has a type." Click **Draft again with AI** if a key is set. |
| 0:35 | Contacts tab | "She uploads the members' spreadsheet. Every problem is visible before a call: a missing number, a duplicate." |
| 0:50 | **Test a call** dialog | Type two replies as a member, one vague ("it was fine"). "Watch the follow-up: it asks why. In fixed mode it would not." |
| 1:10 | Outreach panel | "Calling goes through CALL-E inside calling hours, up to two attempts, within a budget. Start needs a confirmation; pause stops new dials at once." |
| 1:25 | Responses tab → a call page | "Transcript beside the recorded answers. A refusal is stored as declined, never filled in." |
| 1:40 | Report tab | "Findings are written by analyst agents per question, merged, and checked by a reviewer. Every quote links to its call; counts come from the database; gaps are listed." Ask: "Was the hands-on session a success or a problem?" |
| 1:55 | Connected apps / Discord | "The same campaign runs from Discord, and the report publishes to Notion." End with one reliability check: the duplicate contact and the declined answer both stayed visible. |

Do not imply a scheduled callback has happened; the calendar entry is created only when scheduled, and marked done only after the call.
