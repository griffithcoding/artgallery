# Artist Records Enrichment — Design

**Date:** 2026-06-18
**Status:** Awaiting review
**Program context:** Phase 0 (first, independent sub-project) of the larger
"maximal design control" CMS program.
- **This sub-project (Phase 0):** richer artist records — new fields, CV PDF, a
  `featured` flag, and surfacing. Data foundation; ships fast; no composer needed.
- **Immediate next (Phase 0.5):** a richer **fixed premium page template** for
  featured artists (separate spec) — consumes this phase's `featured` flag + fields.
- **Later program:** the per-page **block/section composer** + design tokens, which
  can eventually make the premium pages fully editable.

## Goal

Give each artist a richer, more credible record — how long they've practiced, when
the gallery began representing them, where they're based, how many works they have on
the site, their CV, and where to find them online — surfaced on the public artist
page, the owner admin, and the artist's own Studio profile. Add a `featured` flag
that badges and prioritizes flagship artists (and gates the premium template next).

## Edit-permission model (who controls what)

Principle: **representation + curation facts belong to the gallery owner;
self-description belongs to the artist.**

| Field | Type | Owner admin | Creator Studio | Public |
|---|---|:--:|:--:|:--:|
| `represented_since` | year (int) | ✅ edit | read-only context | ✅ "Represented since 2021" |
| `featured` | bool | ✅ edit | ❌ never | ✅ "Featured" badge + priority |
| `active_since` | year (int) | ✅ edit | ✅ edit | ✅ "Years active: N" (derived) |
| `based_in` | text | ✅ edit | ✅ edit | ✅ |
| `website_url` | text (url) | ✅ edit | ✅ edit | ✅ link |
| `instagram_url` | text (url) | ✅ edit | ✅ edit | ✅ link |
| `education` | text (one line) | ✅ edit | ✅ edit | ✅ |
| `cv_url` | PDF (url) | ✅ upload | ✅ upload | ✅ "Download CV" |
| `nationality` | text | ❌ **never** | ✅ edit (optional) | ✅ if set |
| **Works on site** | *derived count* | ✅ shown | ✅ shown | ✅ "Works on view: N" |

- `featured` and `represented_since` are owner-write only (curation /
  representation decisions, not artist self-service).
- "Years active" is **derived** (`currentYear − active_since`, clamped ≥ 0) so it
  never goes stale; we store the start year.
- "Works on site" is **derived** from the catalogue (count of `artworks`).

## Data model / migration

```sql
alter table public.artists
  add column if not exists represented_since int,
  add column if not exists active_since      int,
  add column if not exists based_in          text default '',
  add column if not exists website_url       text default '',
  add column if not exists instagram_url     text default '',
  add column if not exists education         text default '',
  add column if not exists nationality       text default '',
  add column if not exists cv_url            text default '',
  add column if not exists featured          boolean not null default false;
```

Applied to the live Supabase project and added to `supabase/schema.sql`. RLS
unchanged (public read already covers `artists`; writes stay service-role/owner +
scoped creator).

## CV PDF upload

Reuse the existing `/api/upload` flow, extended:
- Add `application/pdf` to the allowed types **only for a new `cv` kind**; keep
  images at 5 MB, allow PDFs up to 10 MB; store at `cv/<uuid>.pdf` in the public
  `gallery-images` bucket; return the public URL into a hidden `cv_url` field.
- `src/scripts/admin-upload.ts` learns the `cv` kind (a `<input type="file"
  data-kind="cv" accept="application/pdf">`), mirroring the image upload UX.
- Public artist page renders a **"Download CV (PDF)"** link when `cv_url` is set
  (`rel="noopener" target="_blank"`).

## Surfaces

### Public artist page (`src/pages/artists/[slug].astro`)
Editorial **credentials block** beside the portrait (definition list): *Represented
since · Years active · Based in · Works on view · Education*, with **Website /
Instagram** links, a **Download CV** link, and the **Featured** badge when set. Each
row renders only if its value is present. (The richer premium *layout* for featured
artists is the next sub-project; this phase keeps the existing template + the new
block.)

### Owner admin — edit form (`src/pages/admin/artists/[id].astro`)
Inputs for `represented_since`, `active_since`, `based_in`, `website_url`,
`instagram_url`, `education`, a **CV PDF upload**, and a **Featured** checkbox.
Read-only "**Works on site: N**". (No `nationality`.) Persist via
`/admin/artists/save`.

### Owner admin — list (`src/pages/admin/artists/index.astro`)
Per-artist line: "**N works · represented since YYYY**" + a **★ Featured** marker.
Featured artists sorted first. Needs per-artist counts (grouped query via the seam).

### Creator Studio profile (`src/pages/studio/profile/index.astro`)
Inputs for `active_since`, `based_in`, `website_url`, `instagram_url`, `education`,
**CV upload**, and `nationality` (creator-only). Read-only "Works on site: N",
"Represented since YYYY", and featured status (context, not editable). Persist via
`/studio/profile/save`, ownership-scoped as today.

### Artists index (`src/pages/artists/index.astro`)
Featured artists ordered first with a small **Featured** badge on their card; the
grid otherwise unchanged.

## Code touch points

- `supabase/schema.sql` — columns (+ apply migration to live DB).
- `src/lib/supabase/types.ts` — extend `ArtistRow`.
- `src/lib/gallery.ts` — extend `Artist`; add `getArtistWorkCounts()` (grouped
  count → map) and order artists `featured` first.
- `src/lib/mappers.ts` — map new columns (defaults for generator fallback).
- `src/pages/api/upload.ts` — `cv` kind + PDF support + 10 MB cap.
- `src/scripts/admin-upload.ts` — handle the `cv` kind.
- `src/pages/admin/artists/[id].astro` + `save.ts` — owner fields + CV + featured.
- `src/pages/studio/profile/index.astro` + `save.ts` — creator fields + CV (− represented_since, − featured).
- `src/pages/artists/[slug].astro` — credentials block, CV link, featured badge.
- `src/pages/admin/artists/index.astro` — list enrichment + featured order.
- `src/pages/artists/index.astro` + `src/components/ArtistCard.astro` — featured badge + order.
- `src/styles/styles.css` / `admin.css` — credentials list + badge styles.

## Error handling & edge cases

- All new fields optional; empty values render nothing (no empty labels).
- `active_since` future / after `represented_since` → still display; years clamp ≥ 0.
- URL fields: store as entered; prefix `https://` if scheme missing; Instagram
  accepts a handle or full URL.
- CV upload: reject non-PDF / > 10 MB with a clear message; replacing a CV uploads a
  new object and overwrites `cv_url` (old object may be left orphaned — acceptable).
- Generator fallback artists lack new fields → mappers default them; rows simply omit
  those bits. No breakage.

## Verification

- Migration applied; `select` shows new columns.
- Owner edit/save persists all owner fields + featured; no nationality input present.
- Creator edit/save persists self-description + nationality + CV; can't edit
  represented_since/featured; scoped to own artist.
- CV upload accepts a PDF, rejects images/oversize; public "Download CV" works.
- Featured: badge + featured-first order on Artists page and admin list.
- Public credentials block shows only-set rows, working links, live works count.
- Production build passes; spot-check on the dev preview.

## Next sub-project (Phase 0.5) — Featured-artist premium page template

Own spec/plan after this ships. A richer **fixed** template rendered for
`featured` artists: full-bleed portrait hero, artist statement, larger selected-works
layout, CV embed, and (data permitting) exhibitions/press. Likely needs a small
amount of new data (e.g., an artist `statement`, structured exhibitions/press per
artist) — scoped then. Visual-heavy, so it'll use mockups + the frontend-design
skill. The later composer can upgrade this template to fully editable.

## Out of scope (this sub-project)

- The premium page *layout* (next sub-project) and the block/section composer +
  design tokens (later program).
- Per-artist structured exhibitions/press, "artist statement" field — deferred to the
  premium-template spec.
- Multiple CV versions / CV history.
- `nationality` anywhere in the owner admin.
