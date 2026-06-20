# Exhibitions CMS — Design Spec

**Date:** 2026-06-20
**Branch:** `feat/gallery-backend-portal`
**Status:** Approved

## Goal

Let the gallery owner manage exhibitions (current / upcoming / past) from the backend
CMS, with long-form descriptions and a per-exhibition hero image — replacing the
hardcoded generator data that currently backs the public exhibitions pages.

## Current state

- `exhibitions` + `exhibition_artists` tables already exist in `supabase/schema.sql`
  (RLS public-read, `updated_at` trigger). `ExhibitionRow` already typed.
- Public pages render Current/Upcoming/Past groups with subtitle + blurb
  (`src/pages/exhibitions/index.astro`, `[slug].astro`).
- The read seam (`getExhibitions`/`getExhibition` in `src/lib/gallery.ts`) still returns
  the in-repo generator (`src/lib/data.ts`) — NOT Supabase.
- `AdminLayout` nav links `/admin/exhibitions`, but the page does not exist (404).

## Decisions

- **Long-form description:** add a `description` column; render multi-paragraph body on
  the detail page. Keep the short `blurb` for listing cards.
- **Hero image:** add a `hero_image_url` column + upload in the CMS; fall back to the
  artist-work derived image when none uploaded.
- **Never-blank fallback:** when Supabase is configured but the exhibitions table is
  empty (or errors), the read seam returns the generator data so the live page is never
  blank pre-population. As soon as one real exhibition exists, only DB rows show.

## Changes

### 1. Schema migration (idempotent)
Add to `supabase/schema.sql` — in the `create table` block and as standalone alters for
the live DB:
```sql
alter table public.exhibitions add column if not exists description text default '';
alter table public.exhibitions add column if not exists hero_image_url text;
```
Must be applied in the Supabase SQL editor before the CMS can persist these fields.

### 2. Types — `src/lib/supabase/types.ts`
`ExhibitionRow`: add `description: string; hero_image_url: string | null`.

### 3. Mapper — `src/lib/mappers.ts`
- `formatDateRange(start, end)` — `"May 22 – Jul 12, 2026"`; handles same-year,
  cross-year, single-sided, and empty. Parses `YYYY-MM-DD` by string parts (no TZ skew).
- `exhibitionYear(start, end)` — derive `year` (end year, else start, else 0).
- `rowToExhibition(row, artistIds)` — `ExhibitionRow` + joined artist ids → `Exhibition`.

### 4. Read seam — `src/lib/gallery.ts`
- `Exhibition` interface: add `description?: string; heroImage?: string`.
- `getExhibitions()` — dual-mode; query `exhibitions` + `exhibition_artists(artist_id)`,
  order `sort_order`, then `start_date desc`. Zero rows / error → generator.
- `getExhibition(slug)` — query by slug with join; miss / error → generator find.
- `getArtistById(id)` — make dual-mode (Supabase by id, fall back to generator find) so
  both DB-backed (UUID) and generator-fallback (`a0`) exhibitions resolve artists.

### 5. Upload whitelist — `src/pages/api/upload.ts`
Add `'exhibitions'` to `PREFIXES`.

### 6. Admin module — `src/pages/admin/exhibitions/` (mirrors `artists/`)
- `index.astro` — list: status badge, dates, artist count; +New, Edit, Delete.
- `new.astro` / `[id].astro` — forms; `[id]` preloads joined artists.
- `save.ts` — auth-checked upsert; unique slug on insert; sync `exhibition_artists`
  (delete-then-insert selected `artist_ids`).
- `action.ts` — auth-checked delete (joins cascade).
- Fields: title, subtitle, status, start_date, end_date, blurb, description,
  hero image (`data-kind="exhibitions"`), sort_order, artists (multi-select).

### 7. Public pages
- `index.astro` — prefer `e.heroImage`, else derived artist-work image.
- `[slug].astro` — `heroImage` hero when present; render `description` paragraphs in
  place of the boilerplate when present, else current fallback text.

### 8. Tests + verification
- Unit tests (`src/lib/mappers.test.ts`): `formatDateRange` cases + `rowToExhibition`.
- `npm test`, `astro check`, `astro build` pass. Preview admin + public locally.

### 9. Ship
- Commit on `feat/gallery-backend-portal`; `git push origin HEAD:main` (Vercel builds).
- Apply the schema migration in Supabase.
