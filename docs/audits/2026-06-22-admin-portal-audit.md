# Admin Portal & Site Audit — 2026-06-22

Scope: existing portal + public site (pre-Phase-4). Three axes: **code efficiency**,
**website functionality**, **usability for an older, non-technical gallerist** who must
add/edit artists, add artworks + images, and edit site info on her own.

Method: 3 parallel review passes + direct verification of every headline claim +
`npm test` (52/52 pass, 6 files) + `npm run build` (green, Vercel server build).

---

## Verdict

- **Functionality:** Happy paths work; build + tests green. Robustness is weak on the
  *error* path — admin writes report success even when the DB write fails.
- **Code efficiency:** Clean at current size. Real risk is read-path scaling — several
  public pages run N+1 queries / full-table `SELECT *` that degrade toward hundreds of works.
- **Gallerist usability: FAIL today.** She can stumble through editing an *artist* once shown
  the menu, but **artwork inventory and all page/contact editing are unreachable from the nav**,
  the page **composer is a developer tool**, and **iPhone (HEIC) photos silently fail to upload.**

**Top 5 fixes (ranked by impact ÷ effort):**
1. Add **Artworks** + **Pages** to the admin nav (1-line array edit). Unblocks inventory + page editing. *(U1)*
2. Fix **image upload**: tighten `accept` to JPG/PNG/WebP, give a real error message, disable Save during upload. *(U5)*
3. **Check `{ error }` in every save/action handler** — stop reporting false "Saved". *(F1)*
4. Rewrite the **dashboard** into "start here" task cards (also kills dead copy). *(U4 — Phase 4)*
5. Add a **plain Contact/Visit/Hours form** (the gallerist's real "Settings" need). *(U2)*

---

## Axis 1 — Gallerist usability (older, non-technical)

### Blockers
- **U1 — Artworks & Pages not in the menu.** `src/layouts/AdminLayout.astro:6-13` lists only
  Dashboard, Homepage, Artists, Inquiries, Exhibitions, Art Fairs. `/admin/artworks` and
  `/admin/pages` exist but are reachable only by typing a URL. She cannot find inventory or any
  editable page. **Fix:** add both to the nav array.
- **U2 — No plain way to edit contact / visit / hours.** That content lives only inside composer
  pages (`/p/[slug]`), reachable through the hidden Pages screen and edited via the power-user
  composer. For this persona, "edit contact info" is effectively impossible. **Fix:** a simple
  labeled form (address, hours, email, phone). *(Note: we cut "Settings" from Phase 4 as YAGNI —
  but this minimal contact editor is the part she genuinely needs. Reconsider a thin version.)*
- **U3 — The page composer is a developer tool.** `src/scripts/composer.ts` + `composer-layout.ts`:
  in-place `contentEditable`, dark Composer bar (Content/Layout/Type/Color/Preview), drag block
  handles (☰ ＋ ✖), block-type menu, and an unexplained **Save vs Publish** split. Jargon
  ("blocks", "richText"), no instructions. **Fix:** route her tasks through plain forms; reserve
  the composer for staff.

### High
- **U4 — Dashboard misleads + offers no starting point.** `src/pages/admin/index.astro:9-13` tells
  her to manage "viewing rooms and press" (removed) and exposes dev jargon. **Fix:** Phase 4
  dashboard — big task cards: "Add an artist / artwork", "Change homepage photo", "Edit contact info".
- **U5 — Image upload accepts files the server rejects, dead-ends.** 6 inputs use `accept="image/*"`
  (`artworks/{new,[id]}.astro`, `artists/{new,[id]}.astro`, `exhibitions/{new,[id]}.astro`) but
  `src/pages/api/upload.ts:6,26` allows only JPEG/PNG/WebP; `admin-upload.ts:44` shows a flat
  "Upload failed." An iPhone HEIC photo — her most likely file — fails with no reason. Homepage
  already does it right (`accept="image/jpeg,image/png,image/webp"`). **Fix:** copy that, and make the
  error say "Use a JPG, PNG, or WebP under 5 MB."
- **U5b — "Uploaded ✓" can lie.** `admin-upload.ts:35-47` has no submit lock; clicking Save before
  the upload finishes saves a record with an empty image URL, silently. **Fix:** disable submit while
  uploading; block submit if a file is chosen but not yet uploaded.
- **U6 — Featuring a work on the homepage is a hidden treasure hunt.** `admin/homepage/index.astro:40-43`
  tells her to open the artist, edit the work, and tick a "Featured" checkbox three screens away.
  **Fix:** a "Featured on homepage" toggle list on the Homepage screen itself.

### Medium / Low
- **U7a** new vs edit artist forms have different field sets (5 vs ~15) — confusing.
- **U7b** micro-jargon with no help text: "Discipline", "Subject", "Ratio", "Sort order", "Medium".
  Auto-detect ratio; hide "Sort order" from her view; add one-line hints.
- **U7c** success message is tiny low-contrast green that vanishes on next click — make it a clear banner.
- **U7d** UI type is small/low-contrast for older eyes (nav 0.72rem, labels 0.66rem uppercase,
  greys `#7c7a77`/`#8a8675`); tap targets small. Bump sizes, darken secondary text.

---

## Axis 2 — Functionality & correctness

### High
- **F1 — Admin writes swallow DB errors → false "Saved" + silent data loss.** Every
  `save.ts`/`action.ts` (artists, artworks, exhibitions, fairs, inquiries) fires the
  `admin.from(...)` write without checking `{ error }` and unconditionally redirects to `?saved=1`.
  A failed insert/update (constraint, bad UUID, RLS, outage) shows "Saved" while nothing persisted.
  **This is the single most impactful correctness fix.** Destructure `{ error }`; surface failure.

### Security — stored XSS (verified, but admin-only-injectable; defense-in-depth)
Threat model: today only the single trusted admin can write these fields, so practical risk is
**low (self-XSS)**. But both are latent and cheap to fix, and become real the moment an import path
or a second account exists — fix before any such Phase-4-era feature.
- **F2 — Artist bio rendered unsanitized.** `src/pages/artists/[slug].astro:49`
  `set:html={artist.bio}` — `sanitizeRichHtml()` exists in `src/lib/sanitize.ts` but isn't applied;
  `artists/save.ts:23` stores raw. **Fix:** sanitize on save (preferred) or at render.
- **F3 — Works JSON island not script-escaped.** `src/pages/works/index.astro:92`
  `set:html={JSON.stringify(artworks)}` with no `</`-escaping; artwork title/medium/dimensions stored
  raw. A title with `</script>…` breaks out. **Fix:** `.replace(/<\//g,'<\\/')` — the pattern already
  used at `src/pages/admin/pages/[slug].astro:15`.

### Medium
- **F4 — Orphaned storage objects.** `api/upload.ts` uploads before the record saves and never deletes
  on replace or on record delete (`*/action.ts`). Storage accumulates orphans. *(Phase 4's media-library
  in-use/orphan view directly addresses cleanup.)*
- **F5 — Slug collisions fail silently.** Schema has `slug unique` on artists/artworks/exhibitions, so
  duplicates can't be inserted — but a colliding insert errors at the DB and is hidden by F1's
  unchecked-error pattern (shows "Saved", nothing written). Fixing F1 surfaces it; the suffix logic in
  `save.ts` already avoids most collisions.

### Low
- **F6 — Inquiry rate-limit + CSRF edges.** `api/inquire.ts` keys the 5/min cap on spoofable
  `x-forwarded-for`; `middleware.ts:23` skips the Origin/Host check when `Origin` is absent. Low risk
  (cookies are `SameSite=Lax`). Use the platform's trusted client IP; consider a `Referer` fallback.
- **F7 — Unguarded `createSupabaseAdmin()` in some admin reads** (`inquiries/index.astro:11`,
  `artworks/[id].astro:7`) 500s the whole admin section if the service key is missing. Wrap/guard.

---

## Axis 3 — Code efficiency

### High (read-path scaling)
- **E1 — N+1 / over-fetch on public pages.** `artists/index.astro` calls `getWorksByArtist()` per artist
  for one thumbnail; `exhibitions/[slug].astro:24-26` awaits `getWorksByArtist()` in a sequential
  per-artist loop; `exhibitions/index.astro` loads all works yet still queries per exhibition;
  `components/blocks/WorksGrid.astro:6` runs a full `getArtworks()` (with artist join) per grid block.
  Fine at dozens, degrades toward hundreds. **Fix:** fetch once, filter in memory, or `.in(...)`.

### Medium
- **E2 — Repeated full-table slug read** in `artworks/save.ts:36`, `artists/save.ts:38`,
  `exhibitions/save.ts:39` (`select('slug')` over the whole table on insert) — extract a shared
  `nextUniqueSlug()` and probe with `.eq('slug',…).limit(1)`.
- **E3 — Serial independent awaits** on `index.astro:8-12` — `Promise.all` the three reads.
- **E4 — No pagination** on `works/index.astro`, admin `artworks/index.astro`, `inquiries/index.astro`
  — add `.range()`/`.limit()` once volume warrants.

### Low
- **E5 — `tldraw` still in `package.json` deps** despite the Studio removal — dead dependency
  (bloats install; not shipped if unimported). Remove it. `sortablejs` is used by the composer.
- **E6 — Inquiry notifications awaited before responding** (`api/inquire.ts:84`) add email latency to
  submit despite the "never block" comment — make fire-and-forget.
- **E7 — Duplicated boilerplate**: auth preamble in every handler; hero-image lookup duplicated in
  `index.astro` and `admin/homepage/index.astro`. Extract helpers.

---

## What this means for Phase 4

Phase 4 as scoped (Dashboard, Global search, Media library) addresses **U4** (dashboard) and **F4**
(media orphans) — but **none of the three hard blockers** (U1 nav, U2 contact editor, U3 composer) and
not **U5** (upload). Recommendation: fold the cheap blocker fixes into the Phase 4 build, since they
directly serve the "older gallerist runs it alone" goal:
- U1 nav links + U5 upload fix are ~1 hour combined and are prerequisites for the dashboard quick-actions
  to even be reachable.
- Reconsider the dropped "Settings" as a **minimal contact/visit/hours form** (U2) — that's the part she
  actually needs, not a full settings system.
- Keep search + media-library as planned.
