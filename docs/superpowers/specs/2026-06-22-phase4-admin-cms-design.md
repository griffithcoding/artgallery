# Phase 4 — Owner-Ready Admin CMS (design)

Date: 2026-06-22 · Branch: feat/gallery-backend-portal · Supersedes the in-chat draft.

## Goal

Finish the gallery CMS so a **non-technical, older gallery owner can run the entire site
alone** — add/edit artists, add artworks + images, feature work on the homepage, edit
contact/hours, and find anything — without help. Folds in the cheap blockers surfaced by the
2026-06-22 audit (`docs/audits/2026-06-22-admin-portal-audit.md`).

Originally Phase 4 = Dashboard + Global search + Media library. The audit showed those three
don't address the actual blockers, so this spec adds three small hardening/owner-readiness
groups (A, E, F) around them.

## Non-goals (YAGNI)

- No full multi-field "Settings" system. Only the contact text the owner actually changes.
- No edit of the Google Maps embed / geo coordinates from the UI (rare; dev task).
- No rework of the page composer itself — instead we make the owner's common tasks reachable
  through plain forms; the composer stays for staff.
- No pagination/N+1 refactor of public pages (audit group E1/E2) — tracked separately; not blocking.

## House-style constraints

- I/O lives in `.astro` pages / `*.ts` endpoints using `createSupabaseAdmin()` (service role),
  matching the fairs/exhibitions admin. **Logic lives in pure, unit-tested lib functions** (TDD),
  matching `inquiries.test.ts` / `mappers.test.ts`.
- Reuse the existing `admin.css` kit (tables, cards, fields, buttons, badges, `.admin-grid/.admin-tile`).
- Dual-mode philosophy: anything new that reads the DB falls back to a safe default on error.

---

## Work groups

Sequenced by dependency. A is prerequisite (nav makes the rest reachable). Each group is an
atomic commit (or a few), consistent with the multi-commit phase style used for inquiries.

### Group A — Owner-readiness blockers  *(audit U1, U5, F1)*

**A1 — Admin nav + search omnibox** (`src/layouts/AdminLayout.astro`)
- Add `Artworks` and `Pages` to the `links` array (they exist but are unreachable today).
- Add a `Media` link (Group D) and a `Settings` link (Group E).
- Add a search `<form method="GET" action="/admin/search">` with a single text input, present on
  every admin page (feeds Group C). Style with a small addition to `admin.css`.

**A2 — Image-upload hardening** *(the iPhone-HEIC blocker)*
- Change `accept="image/*"` → `accept="image/jpeg,image/png,image/webp"` on all six inputs:
  `artworks/{new,[id]}.astro`, `artists/{new,[id]}.astro`, `exhibitions/{new,[id]}.astro`
  (homepage already correct — copy it).
- `src/pages/api/upload.ts`: return descriptive reasons in the body (e.g. `415 "Use a JPG, PNG,
  or WebP image."`, `413 "Image must be under 5 MB."`) instead of `"Bad type"`/`"Too large"`.
- `src/scripts/admin-upload.ts`: (a) surface `res.text()` as the error message instead of a flat
  "Upload failed."; (b) disable the form's submit button while `Uploading…`, re-enable on
  `Uploaded ✓`/failure; (c) if a file is chosen but the hidden URL is still empty, block submit
  with a clear message. Keep the instant local preview.

**A3 — Surface save/delete failures** *(stop the false "Saved")*
- Add a tiny shared helper `src/lib/adminResult.ts` → `redirectSaved(url)` / `redirectError(url, msg)`
  building the `?saved=1` / `?error=<msg>` redirect Response. Pure string logic → unit-tested.
- Every `*/save.ts` and `*/action.ts` destructures `{ error }` from its Supabase write and, on
  error, redirects with `?error=`; list/edit pages render an `.admin-status.err` banner when
  `error` is present (several already read `?saved`). No silent success.

### Group B — Dashboard + onboarding checklist  *(original #1; audit U4)*

- `src/lib/dashboard.ts` → `buildChecklist(counts): ChecklistItem[]` — pure. Given
  `{artists, artworks, exhibitions, fairs, homepageHero:boolean}` returns ordered items
  `{label, href, done}`: *Add your first artist → first artwork → create an exhibition → add an
  art fair → set the homepage photo*. `+ dashboard.test.ts`.
- `src/pages/admin/index.astro` — full rewrite (deletes the dead "viewing rooms and press" copy):
  - **Stat cards**: Artworks · Artists · Exhibitions · Fairs · Inquiries (emphasize *new* count).
    Inline `count` queries (`select('*', { count:'exact', head:true })`).
  - **"Start here" task cards / checklist** from `buildChecklist`; each links to the relevant
    `+ New` page; collapses to "Setup complete ✓" when all done.
  - **Recent inquiries**: last 5 (name + status badge + date) linking to the inbox.
  - **Quick actions**: pill buttons + New artwork / artist / exhibition / fair.
- New `admin.css` classes: stat cards, checklist/task cards.

### Group C — Global search  *(original #2)*

- `src/lib/search.ts` → `searchAdmin(query, datasets): SearchGroup[]` — pure, case-insensitive
  substring over the meaningful fields of each entity (artworks: title/medium/year; artists:
  name/discipline; exhibitions: title/subtitle; fairs: name/city; inquiries: name/email/message),
  returns grouped + ranked (exact/startsWith first). `+ search.test.ts`.
- `src/pages/admin/search.astro` (`?q=`) — fetch the datasets via existing getters + inquiries,
  call `searchAdmin`, render grouped results with counts and deep links; empty-state when blank/no hits.
- Omnibox wired in A1.

### Group D — Media library  *(original #3; audit F4 cleanup)*

- `src/lib/media.ts` →
  - `collectReferencedUrls(records): Set<string>` — gathers every referenced image URL from
    `artworks.image_url`, `artists.portrait_image_url`, `exhibitions.hero_image_url`,
    `posts.cover_image_url`, **and a string-scan of `pages.blocks` jsonb** for storage URLs.
  - `classifyObjects(objects, referenced): MediaItem[]` — marks each `inUse | orphan`.
  - both pure → `media.test.ts`.
- `src/pages/admin/media/index.astro` — list objects across image prefixes
  (`artworks/ artists/ exhibitions/ posts/ pages/ library/`; `cv/` PDFs excluded), classify via the
  pure fns, render with `.admin-grid/.admin-tile`: thumbnail, **In use / Orphan** badge,
  **Copy URL**, **Delete** (confirm; in-use shows an extra "still referenced" warning).
- `src/pages/admin/media/action.ts` — POST delete → `admin.storage.from('gallery-images').remove([path])`,
  with `{ error }` handling (Group A3 pattern).
- A simple **Upload to library** control reusing `api/upload.ts`; add `'library'` to its `PREFIXES` set.

### Group E — Minimal contact/hours settings  *(audit U2)*

- **Migration** (append to `supabase/schema.sql`, run on live DB): `site_settings` single-row table
  (`id smallint primary key default 1 check (id=1)`, columns: `email text, phone text, hours text,
  address_line text, address_city text, instagram_url text, updated_at`). RLS: public read; writes
  via service role only (matches inquiries/pages convention).
- `src/lib/settings.ts` → `getSettings(): Promise<SiteSettings>` — dual-mode: read the row, **merge
  over defaults derived from `BRAND`**, fall back to `BRAND` defaults on unconfigured/error/empty.
  `getDefaults()` (pure, from BRAND) is unit-tested via `settings.test.ts`; the I/O wrapper mirrors
  `gallery.ts`.
- `src/pages/admin/settings/index.astro` + `save.ts` — plain labeled form (Gallery email, Phone,
  Opening hours, Street address, City line, Instagram URL), upsert id=1, A3 error handling, success banner.
- Rewire consumers to `await getSettings()` and set `export const prerender = false`:
  `src/components/Footer.astro`, `src/pages/contact.astro` (replace the hardcoded email + address at
  lines 25-26), `src/pages/visit.astro` (hours/address prose + JSON-LD `email`/`openingHours`; **map
  embed + geo stay fixed**). Edits go live within the existing 60s edge cache.
- Settings link added to nav in A1.

### Group F — Security hardening  *(audit F2, F3 — one-liners; recommended)*

- `src/pages/admin/artists/save.ts` — `sanitizeRichHtml(bio)` before insert/update (helper already
  in `src/lib/sanitize.ts`); keep render as-is or also guard `artists/[slug].astro:49`.
- `src/pages/works/index.astro:92` — escape the JSON island: `JSON.stringify(artworks).replace(/<\//g,'<\\/')`
  (same guard used at `admin/pages/[slug].astro:15`).

---

## Data flow

- Public reads: unchanged except contact/visit/footer now `await getSettings()` (dual-mode → BRAND).
- Admin reads/writes: service-role, with `{ error }` checked everywhere (A3).
- Pure logic (`buildChecklist`, `searchAdmin`, `collectReferencedUrls`, `classifyObjects`,
  `getDefaults`, `adminResult`) is fully unit-tested and DB-free.

## Error handling

- Every write checks `{ error }`; failures redirect with `?error=` and show a red banner — no false success.
- `getSettings`, dashboard counts, search, media listing all fall back gracefully (empty/defaults) on error.
- Upload: descriptive 4xx bodies surfaced to the user; submit locked until upload completes.

## Testing & verification

- TDD for all six pure modules (write `*.test.ts` first).
- `npm test` green (current 52 + new), `npm run build` green.
- Browser-verify: each new/changed admin route renders and is auth-gated; upload rejects a non-JPEG
  with the new message and locks submit; a settings edit appears on /contact, /visit, footer; media
  badges reflect a known in-use vs orphan image; search returns grouped hits.

## Sequencing & commits

A (blockers) → B (dashboard) → E (settings, has migration) → C (search) → D (media) → F (hardening,
independent). Each group = atomic commit(s); FF to `main` per the deploy convention after build/tests green.

## Open decisions for review

1. Include **Group F** (security one-liners) now, or split to its own tiny PR? (Recommend: now.)
2. Settings fields list — is {email, phone, hours, address line, city line, Instagram} the right
   minimal set, or also include the newsletter/“represented” blurb?
