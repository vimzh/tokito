# Phase 3 — Contact lists

Status: complete, September 13, 2026.

## Outcome

An organizer uploads an Excel or CSV file, confirms which columns hold names and phone numbers, keeps extra columns as per-person context, and leaves with a reviewed call list where every problem (missing number, invalid number, duplicate, opted out) is visible before anything is called. Re-uploading the same file never doubles anyone. A workspace opt-out list blocks numbers everywhere.

## Design

- **Two-step import.** Step 1 uploads the file; the API parses it with SheetJS, stores headers and rows on a `contact_imports` row, and returns a preview with a suggested column mapping. Step 2 commits the mapping; the API validates every row and creates `contacts`. Nothing is created until the organizer confirms the mapping.
- **Every row becomes a contact row**, including bad ones, with a `status` and a `problem`, so the organizer sees exactly what was skipped and why. Statuses: `ready`, `invalid`, `duplicate`, `opted_out`, `excluded`. Problems: `missing_phone`, `invalid_phone`, `duplicate_in_file`, `duplicate_existing`, `opted_out`.
- **Numbers** are normalized to E.164 with `libphonenumber-js`, using the campaign's default country (new `default_country` preference on campaigns and workspace settings, default `IN`).
- **Opt-outs** live in a workspace-level `opt_outs` table keyed by E.164 phone. Commits and edits check it; adding an opt-out marks matching contacts in every campaign `opted_out`.
- **Fixing rows.** A contact's name and phone can be edited; the API re-validates and recomputes the status. A contact can be excluded or deleted.

## Tasks

1. Schema (migration 0002): `contact_imports`, `contacts`, `opt_outs`, and `default_country` on campaigns and workspace settings.
2. API: upload, preview, commit, list with counts, update, delete, opt-out list/add/remove. Row cap of 5,000 per file.
3. Tests: parse a CSV with blanks, malformed numbers, and repeats; commit; re-commit the same file; opt-out blocking; fixing a number.
4. Web: Contacts tab on the campaign page with upload, mapping, summary, counts by status, filters and search, per-row edit, exclude, and delete. Default country joins the preference fields. Opt-out list on the Settings page.

## Acceptance checks

1. The sample file with blanks, malformed numbers, and repeated rows imports with every problem visible before calling.
2. Re-uploading the same file creates no new ready contacts; the repeats show as duplicates.
3. A number on the opt-out list can never reach `ready`, including through an edit.
4. Lint, typecheck, build, and API tests pass.

## Completion note

**What changed.**

- Migration 0002 adds `contact_imports`, `contacts`, `opt_outs`, and `default_country` on campaigns and workspace settings. Contacts keep insertion order (SQLite rowid) so the table matches the file.
- Parsing uses SheetJS (`xlsx`) with raw cell values converted by hand so large phone numbers are never rendered in scientific notation. Numbers are normalized with `libphonenumber-js` against the campaign's default country.
- Uploads go through a typed multipart route (`zValidator('form', …)`) so the web client sends the file with full types. Next.js server actions carry the file, with `bodySizeLimit` raised to 6 MB to match the API's 5 MB cap.
- Hono RPC quirk found and worked around: any route with a validator carries an extra untyped `{}` response member from the validation hook, and `InferResponseType`'s status filter cannot drop it. `src/lib/api.ts` wraps every response type in a `NonEmpty` helper. Routes with validators also declare explicit statuses.
- Removing a number from the opt-out list does not restore contacts already marked opted out; the organizer re-includes them by editing. Recorded here as a known limit.

**Checks run.**

| Check | Result |
|---|---|
| `bun run lint`, `bun run typecheck`, `bun run build` | Pass |
| `bun test` in `apps/api` (19 tests, including CSV parsing, mapping suggestion, classification of blanks, malformed, and repeated rows, re-import, opt-out blocking through edits, fixing and excluding) | Pass |
| Live upload and commit of a 5-row CSV through the running API: 2 ready, 2 invalid, 1 duplicate, each with its problem | Pass |
| HTTP session: campaign page shows the Contacts tab with the count and carries the contact rows; Settings shows the opt-out list and default country; empty campaign shows the empty note | Pass |
| Browser-driven upload, mapping, edit, exclude, remove, and opt-out add or remove | Not run: needs a logged-in browser session |

**What the next phase should know.** `contacts.status = 'ready'` is the only state Phase 5 may dial. `contacts.context` is a flat string map keyed by the chosen column headings; the Phase 4 task builder can pass it to CALL-E as per-recipient context. The `campaign_events` log records each import with its counts.
