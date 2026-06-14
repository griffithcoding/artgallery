# VERSO Gallery — Astro Migration + Backend Portal Design

**Date:** 2026-06-14
**Status:** Approved (design); pending spec review
**Scope:** Migrate the static VERSO gallery site to Astro (SSR) and add a Supabase-backed admin portal centered on real artworks, inquiries, exhibitions/viewing rooms, and a journal blog. Backbone ported from `C:\Users\wgrif\Projects\TheWildBirthDoulah`.

---

## 1. Context

The gallery is currently a flat static HTML/CSS/JS site (no framework, no build). Its public inventory is fiction: `js/data.js` generates 312 random artworks client-side under a "20,000-work open archive" positioning. All price display was removed in a prior task (artworks now show availability only).

The doula project is an Astro 5 SSR + Supabase CMS whose **auth, Supabase clients, middleware, sanitization, and storage patterns** port over almost directly. Its **domain models (blog posts + page-copy slots)** do not fit a gallery and are replaced with gallery models.

### Decisions locked during brainstorming
- **Architecture:** full Astro migration (not a bolt-on portal, not a lighter custom backend).
- **Inventory:** real works only. The public Works page shows only real admin-entered artworks. Drop all "20,000-work / open archive" claims; reframe copy as "a curated collection."
- **Portal scope:** Auth + Artwork/Artist CMS + Inquiry inbox + Exhibitions/Viewing rooms + Journal blog.
- **Out of scope:** inline page-copy CMS (`content_blocks`), brand/theme studio, content revision history. Marketing copy stays in `.astro` templates.

---

## 2. Architecture

- **Astro 5**, `output: 'server'` (SSR), **`@astrojs/vercel`** adapter, **Node 22**.
- **Hosting:** Vercel.
- One repo. Each current HTML page becomes an `.astro` page. Shared `src/layouts/Layout.astro` + `src/components/Header.astro` / `Footer.astro` replace the runtime DOM injection in `js/main.js`. The existing `css/styles.css` moves to `src/styles/` unchanged — the visual design is preserved.
- Public pages render server-side from Supabase using the **anon key** (RLS-limited). `/admin/*` is guarded by ported middleware. Writes use the **service-role key** (server only).
- **Caching:** anonymous GETs on public routes get `Cache-Control: public, s-maxage=60, stale-while-revalidate=86400`; authenticated/admin responses get `private, no-store`.

### Ported from the doula project (adapt, don't rewrite)
- `src/lib/supabase/server.ts` — `createSupabaseServer(cookies, headers)` (cookie-aware anon client) + `createSupabaseAdmin()` (service-role). Reads env from both build and runtime scopes.
- `src/middleware.ts` — session resolution into `context.locals.user`, CSRF host check on write methods to `/admin` + `/_actions`, admin route guard (redirect to `/admin/login`), cache headers. Route lists updated for gallery paths.
- `src/lib/sanitize.ts`, `src/lib/slug.ts` — reused as-is.
- TipTap editor setup + image upload endpoint pattern — reused for the journal.

---

## 3. Data model (Supabase Postgres)

All tables: `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at` (with `touch_updated_at` trigger). RLS enabled on all; public read policies only where noted; **all writes via service-role key** (no anon/auth write policies).

### `artists`
`slug` (unique), `name`, `birthplace`, `birth_year`, `discipline`, `bio`, `portrait_image_url`.
Public read: all.

### `artworks`
`slug` (unique), `title`, `artist_id` (fk → artists), `year`, `medium`, `category`, `subject`, `dimensions`, `ratio` (portrait/landscape/square/tall), `availability` (`'Available'|'Inquire'|'Sold'`), `image_url` (nullable → SVG placeholder fallback), `featured` (bool), `sort_order` (int).
Public read: all.

### `exhibitions`
`slug` (unique), `title`, `subtitle`, `status` (`'On View'|'Upcoming'|'Past'`), `start_date`, `end_date`, `blurb`, `sort_order`.
Link to artists via `exhibition_artists` join table (`exhibition_id`, `artist_id`).
Public read: all.

### `fairs`
`name`, `city`, `booth`, `dates` (text), `status` (`'Upcoming'|'Past'`), `sort_order`.
Public read: all.

### `viewing_rooms`
`slug` (unique), `title`, `description`, `sort_order`, curated artworks via `viewing_room_artworks` join table (`viewing_room_id`, `artwork_id`, `position`).
Public read: all.

### `inquiries`
`artwork_id` (fk, nullable), `artwork_title` (text snapshot), `name`, `email`, `message`, `status` (`'new'|'replied'|'archived'` default `'new'`), `source` (`'artwork'|'contact'`).
No public read. Inserts via service-role from `/api/inquire`; reads in `/admin/inquiries`.

### `posts` (journal/press articles)
`slug` (unique), `title`, `description`, `body` (sanitized HTML from TipTap), `cover_image_url`, `status` (`'draft'|'published'`), `category` (`'Journal'|'Press'|'Exhibitions'`), `published_at`.
Public read: `status = 'published'` only; authenticated read: all.

### `press_mentions` (external coverage, the existing Press page)
`outlet`, `headline`, `url`, `date` (text), `kind` (`'Review'|'Feature'|'Listing'|'Profile'`), `sort_order`.
Public read: all.

### Storage
Bucket `gallery-images` (public read, service-role write) for artwork images, artist portraits, post covers. Upload via session-authenticated server endpoint.

---

## 4. Admin portal (`/admin`)

1. **Auth** — `/admin/login` (email + password), single admin, public signup disabled, httpOnly cookie session via `@supabase/ssr`, `/admin/logout`. Middleware guards all `/admin/*` except login.
2. **Artworks & Artists CMS** — `/admin/artworks` (+ `/admin/artists`): list + create/edit/delete; image upload to `gallery-images`; set availability, featured, sort order, artist link.
3. **Inquiry inbox** — `/admin/inquiries`: list newest-first, read detail, set status. Fed by the public "Inquire about this work" modal and the contact form, both POSTing to `/api/inquire`.
4. **Exhibitions / viewing rooms / fairs / press** — `/admin/exhibitions`, `/admin/viewing-rooms`, `/admin/fairs`, `/admin/press`: CRUD, including artist/artwork linking.
5. **Journal blog** — `/admin/posts`: TipTap rich editor, draft/publish, cover image upload. Public at `/journal` + `/journal/[slug]`.

Admin shell: shared `AdminLayout.astro` with nav, themed to VERSO (dark/editorial), distinct from the public chrome.

---

## 5. Public site changes

- Pages converted to `.astro` dynamic routes reading real data:
  - `index` (home), `works` (was collection.html), `works/[slug]` (artwork detail), `artists`, `artists/[slug]`, `exhibitions`, `exhibitions/[slug]`, `viewing-rooms`, `about`, `visit`, `contact`, `press`, `journal`, `journal/[slug]`, `404`.
- `works` keeps the existing client-side filter/sort/paginate UX, fed real artwork data (embedded JSON or progressive). No price filter/sort (already removed).
- Artworks without `image_url` render the existing seeded-SVG placeholder (`artSVG` logic retained server-side or as a small util).
- All "20,000-work / open archive" copy reframed to "a curated collection." `llms.txt` / `llms-full.txt` / sitemap updated to real routes.
- Inquiry modal + contact form POST to `/api/inquire` (real persistence) instead of the fake thank-you.
- SEO/schema markup (VisualArtwork, Organization, FAQ, breadcrumbs) preserved and driven by real data.

---

## 6. Provisioning (user-owned; cannot be automated here)

1. Create a Supabase project. Run provided `supabase/schema.sql` (tables, RLS, triggers, `gallery-images` bucket).
2. Paste into `.env` (local) and Vercel project env: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Create the single admin user via the Supabase dashboard (Auth → Users). Public site renders without this; only `/admin` requires it.
4. Vercel: import the repo (auto-detects Astro), set the three env vars, deploy. Node 22 comes from `engines.node` in `package.json`.

---

## 7. Testing

- `vitest`: `sanitize` (HTML sanitization), `slug` (slug generation), inquiry payload validation.
- Optional Playwright smoke: admin login → create artwork → appears on `/works`.

---

## 8. Build phases (for the implementation plan)

1. **Scaffold** Astro + adapter + deps; base `Layout`/`Header`/`Footer`; move `styles.css`. Convert public pages reading from a temporary in-repo data module (port of `data.js`) so the site renders identically with no DB yet.
2. **Supabase**: `schema.sql`, ported `server.ts` + `middleware.ts`; wire public pages to DB; minimal seed.
3. **Auth + admin shell** (login, logout, guard, `AdminLayout`).
4. **Artwork + Artist CMS** + image upload.
5. **Inquiry inbox** + `/api/inquire` + public modal/contact wiring.
6. **Exhibitions / viewing rooms / fairs / press CMS.**
7. **Journal blog** (TipTap) + public `/journal`.
8. **Polish**: SEO/schema parity, `llms.txt`/sitemap, caching, deploy docs, tests.
