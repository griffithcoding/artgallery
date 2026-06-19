# Phase 1 — Inquiry Inbox + Lead Pipeline (Design Spec)

**Date:** 2026-06-19
**Parent:** [Elite Gallery CMS — Program Roadmap](2026-06-19-elite-cms-roadmap.md)
**Status:** Design for review.

## 1. Goal & success criteria

Capture every public inquiry (today the modal is a stub that discards them) and give the superadmin a
simple inbox to work leads to close.

**Done when:**
- Submitting the public inquiry modal (general or per-artwork "Inquire") persists a row to `inquiries`
  and shows a real success/error state.
- A spam bot tripping the honeypot, or a flood from one IP, is rejected without storing junk.
- `/admin/inquiries` lists inquiries with filter (status, source), sort (newest first), status badges,
  and a snippet; `/admin/inquiries/[id]` shows the full message + linked work and lets the owner change
  status, add internal notes, reply via a prefilled `mailto:`, and bulk-archive from the list.
- Email alerts/autoresponders are wired but **dormant** until a `RESEND_API_KEY` is set; absence of a
  key never breaks capture.
- `npm run build` is clean; unit + e2e tests pass.

## 2. Locked decisions

- **Email:** inbox-first; email is a pluggable Resend adapter that no-ops unless `RESEND_API_KEY` is set.
- **Pipeline:** lean — `new → contacted → won | lost | archived`.

## 3. Data model

Extend the existing `inquiries` table (migration appended to `supabase/schema.sql`, idempotent
`alter table ... add column if not exists`). Existing columns kept: `id, artwork_id, artwork_title,
name, email, message, created_at`.

| Column | Type | Notes |
|---|---|---|
| `status` | text enum | **Change** allowed set to `new, contacted, won, lost, archived` (default `new`). Migration drops the old check constraint and re-adds. Existing `replied`→ map to `contacted`; `new`/`archived` unchanged. |
| `source` | text enum | Existing `artwork, contact` (default `contact`); unchanged. |
| `phone` | text null | Optional. |
| `consent_marketing` | boolean | default `false`. |
| `consent_ts` | timestamptz null | Set when consent box ticked. |
| `internal_notes` | text | default `''`; owner-only. |
| `status_changed_at` | timestamptz null | Set by the status-change handler (stage aging). |
| `ip` | text null | For the lightweight rate-limit check; never shown publicly. |

RLS stays: **no public policies** on `inquiries`; all reads/writes go through service-role endpoints.

A `rowToInquiry` mapper + an `Inquiry` type land in `lib/mappers.ts` / the types module, matching the
existing `rowToArtwork`/`rowToArtist` pattern.

## 4. Public capture flow — `POST /api/inquire`

New endpoint `src/pages/api/inquire.ts` (`prerender = false`).

1. Parse form / JSON: `name`, `email`, `message`, `phone?`, `consent?`, `artwork_id?`,
   `artwork_title?`, `source` (default `contact`), and a honeypot field `company` (must be empty).
2. **Reject silently-OK** (return 200 with success, but do not store) if the honeypot is filled — bots
   get no signal.
3. Validate: `name` non-empty, `email` matches a basic pattern, `message` non-empty, lengths capped.
   On failure return 400 with a field error the modal renders inline.
4. **Rate-limit:** count `inquiries` rows with the same `ip` in the last 60s via the service-role
   client; if `>= 5`, return 429. (Pragmatic, serverless-safe; documented as best-effort.)
5. Insert via `createSupabaseAdmin()`; set `consent_ts` when consent is true; store `ip`.
6. **Notify (dormant):** call `notifyNewInquiry(inquiry)` — see §6. Failures are caught and logged, never
   block the 200 response.
7. Return success JSON; the modal swaps to a thank-you, or shows the inline error.

CSRF: the existing middleware already enforces a same-origin Origin check on writes to `/api`; the
public form is same-origin, so it passes. `/api` is excluded from public caching (already true).

**Wire the front end:** update `InquiryModal.astro` to `fetch('/api/inquire', …)` with the work
context, render success/error inline, and add the hidden honeypot + optional consent checkbox. The
per-artwork "Inquire" buttons already call `openInquiry(title)`; pass `artwork_id`/`artwork_title`
through to the POST.

## 5. Admin inbox

**List — `src/pages/admin/inquiries/index.astro`:**
- Query newest-first; filters via querystring (`?status=`, `?source=`) applied in the DB query.
- Columns: date · name · work (links to artwork) · source · **status badge** · message snippet.
- A count of `new` inquiries shown in the heading (and later surfaced on the dashboard / nav).
- Empty state: "No inquiries yet — your public Inquire form feeds this inbox."
- Bulk: checkboxes + a "Mark archived / Mark contacted" toolbar posting selected IDs to a bulk action.

**Detail — `src/pages/admin/inquiries/[id].astro`:**
- Full message, contact (email/phone), linked work, source, timestamps.
- **Status control** (lean pipeline) → posts to `save.ts`, which updates `status` + `status_changed_at`.
- **Internal notes** textarea → persisted.
- **Reply** button = `mailto:` prefilled with the collector's address + a subject referencing the work
  (no in-app sending; the owner replies from their own mail client).

**Handlers:** `save.ts` (status + notes update), `action.ts` (delete + bulk archive/contacted) — same
shape as the artworks/artists handlers; service-role; auth-checked.

## 6. Notifications — pluggable Resend adapter (dormant by default)

`src/lib/email.ts` exposes `notifyNewInquiry(inquiry)` and `sendAutoresponder(inquiry)`:
- If `RESEND_API_KEY` is unset → return early (no-op). Capture is unaffected.
- If set → POST to Resend: (a) alert to the gallery (`BRAND.email`) summarizing the inquiry + a deep
  link to `/admin/inquiries/[id]`; (b) a short autoresponder to the collector ("we received your
  inquiry, a representative will reply within one business day").
- All network calls are wrapped; errors are logged and swallowed so a provider outage never 500s the
  public form. `resend` is added as a dependency but only invoked behind the env check.

## 7. Admin list-UX kit (seeded here, reused later)

Phase 1 introduces small, dependency-free building blocks the later modules reuse:
- Status-badge styles (`.badge--new/contacted/won/lost/archived`) in `admin.css`.
- A querystring-driven list pattern (filter `<form method="get">` + sortable column links).
- A bulk-action form pattern (checkboxes in one `<form>` → bulk endpoint).
- Empty-state + inline field-error conventions.

## 8. Tutorial slice (this module)

- Inbox **empty-state coaching** copy.
- A **"How inquiries work" help drawer** (`<details>`/`<dialog>` partial) on the inbox.
- A **setup-checklist item**: "Send a test inquiry and find it in your inbox" (checklist UI itself
  ships with the Phase 6 dashboard; the item definition is authored here).
- A **written-guide section** at `docs/admin-guide/inquiries.md` covering: where leads come from,
  working the pipeline, replying, and turning on email later.

## 9. Testing

- **Unit (Vitest):** validation (good/bad payloads), honeypot rejection, rate-limit counter logic,
  `rowToInquiry` mapper, status-transition guard.
- **e2e (Playwright):** submit modal (general + per-artwork) → row appears in `/admin/inquiries` →
  open detail → change status → persists; honeypot-filled submission stores nothing.

## 10. Out of scope (Phase 1)

- A separate `contacts`/CRM table, contact de-dupe/merge, lead scoring, follow-up reminder sequences.
- The fuller funnel (negotiating/reserved) — lean set only; extensible later.
- In-app email composing/sending (reply is `mailto:` only).

## 11. New / changed files

**New:** `src/pages/api/inquire.ts`, `src/pages/admin/inquiries/{index,[id]}.astro`,
`src/pages/admin/inquiries/{save,action}.ts`, `src/lib/email.ts`, `docs/admin-guide/inquiries.md`,
tests under the existing test locations.
**Changed:** `supabase/schema.sql` (idempotent migration), `src/components/InquiryModal.astro`
(real submit + honeypot + consent), `src/lib/mappers.ts` (+`rowToInquiry`/type), `src/styles/admin.css`
(badges), admin nav (add "Inquiries"), `package.json` (+`resend`).
