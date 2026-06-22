# Elite Gallery CMS — Program Roadmap

**Date:** 2026-06-19
**Project:** Mazlish + Wright Contemporary (artgalleryproject) — Astro 5 + Supabase, deployed on Vercel
**Status:** Approved scope (full phased program); Phase 1 detailed in a companion spec.

## 1. Context

The public site and a super-admin CMS already exist. Crucially, `supabase/schema.sql` already
defines tables for far more than the admin UI exposes. The build is **schema-rich but UI-poor**:

| Domain | Table(s) in schema | Admin UI today | Public today |
|---|---|---|---|
| Artists | `artists` | ✅ full CRUD | ✅ |
| Artworks | `artworks` (availability enum, featured, **no price = price-on-request**) | ✅ full CRUD | ✅ |
| Pages composer | `pages` | ✅ block draft/publish | ✅ `/p/[slug]` |
| Homepage hero | (storage) | ✅ upload | ✅ |
| **Inquiries / leads** | `inquiries` | ❌ none | ⚠️ modal is a **stub** (no POST; leads discarded) |
| **Exhibitions** | `exhibitions`, `exhibition_artists` | ❌ none | ⚠️ generator-only |
| ~~Viewing rooms~~ *(out of scope)* | `viewing_rooms`, `viewing_room_artworks` | ❌ none | ⚠️ index only |
| ~~Journal / Press~~ *(out of scope)* | `posts`, `press_mentions` | ❌ none | ❓ minimal |
| **Art fairs** | `fairs` | ❌ none | ⚠️ static page |
| Dashboard / settings / media | — | ⚠️ placeholder | — |

Auth was simplified to a **single `super_admin` role** (the `/studio` artist portal was removed),
so every admin surface targets one user type: the gallery owner.

## 2. Research summary — what "elite" means

Synthesized from four research streams (2026-06-19): dedicated gallery platforms (Artlogic,
ArtBinder, Arternal, Vortic), blue-chip gallery sites (Zwirner, Hauser & Wirth, White Cube, Gagosian,
Pace), admin-CMS UX leaders (Sanity, Shopify, Notion, Ghost), and inquiry-CRM / online-viewing-room
conventions.

**The hierarchy of value (highest-signal, lowest-cost first):**

1. **Relational core + lead capture.** Artist ↔ Artwork ↔ Exhibition with an availability flag and
   **price-on-request "Inquire"** routed to a **lead inbox/CRM**. This single flow is the defining
   "blue-chip" signal. We already have the relational core and price-on-request; **the inbox is the
   missing half.**
2. **Admin that feels elite:** draft/publish workflow, status badges, searchable/sortable content
   lists, bulk actions, empty states, a real dashboard, and **outcome-first onboarding** (a persistent
   setup checklist beats a feature tour).
3. **Deliberately deferred / out of scope:** editorial Journal/Press (dropped by decision), online
   viewing rooms (dropped by decision), custom VR/AR, podcasts, gated-pricing accounts,
   custom-checkout commerce.

## 3. Goals & non-goals

**Goals**
- Activate every dormant module with an intuitive admin UI, on the established admin patterns.
- Never lose a lead again; give the owner a simple pipeline to work inquiries to close.
- A reusable admin **list-UX kit** (search/sort/filter/status-badges/bulk/empty-states) shared by all modules.
- A real **dashboard** and a **superadmin tutorial** (in-portal interactive **and** a written guide).
- Keep prices private throughout (price-on-request model).

**Non-goals (this program)**
- Invoicing, consignments, payments, multi-currency accounting.
- Custom checkout / e-commerce (defer to hosted Shopify if ever needed).
- Immersive 3D/VR/AR, gated-pricing collector accounts, podcasts.
- **Online viewing rooms** (dropped by decision; the `viewing_rooms` / `viewing_room_artworks` tables stay dormant and unused).
- **Editorial Journal / Press** (dropped by decision; the `posts` / `press_mentions` tables stay dormant and unused).
- Re-introducing the artist/creator portal (removed by decision).

## 4. Module decomposition & sequence

Each module is its own **spec → plan → build → verify** cycle. Order is by value-to-effort.

1. **Inquiry Inbox + lead pipeline** *(Phase 1 — detailed in companion spec).* Real `/api/inquire`,
   wired modal/buttons, admin inbox with lean pipeline. Seeds the shared admin list-UX kit.
2. **Exhibitions CMS.** CRUD + artist linking + status workflow (On View / Upcoming / Past) +
   featured works; replace generator-only public data with DB-backed reads through the existing seam.
3. **Art Fairs.** Simple CRUD on `fairs` (name, city, booth, dates, status).
4. **Dashboard + Settings + Media library + global search.** Real dashboard (counts, drafts, recent
   inquiries, quick-create, onboarding checklist); a `settings` table to move hours/address/contact out
   of `site.ts`; a media browser over the `gallery-images` bucket; cross-module search.

**Cross-cutting, delivered incrementally:**
- **Admin list-UX kit** — introduced in Phase 1, reused everywhere after.
- **Superadmin tutorial** — a persistent **setup checklist** + an **outcome-first guided tour**
  ("publish your first X") + **contextual help drawers**, plus a **written guide**
  (`docs/admin-guide/`). Each module contributes its own checklist item, help-drawer copy, and guide
  section as it lands; the dashboard (Phase 4) hosts the checklist.

## 5. Technical approach (follow existing patterns)

- **Routing/UI:** server-rendered Astro under `src/pages/admin/<module>/` — `index.astro` (list),
  `[id].astro` (edit), `new.astro`, `save.ts` (POST), `action.ts` (delete). `AdminLayout`. Light JS only.
- **Data:** writes via `createSupabaseAdmin()` (service role, bypasses RLS) from `/admin` + `/api`
  endpoints; public reads through the dual-mode seam in `lib/gallery.ts` with `rowToX` mappers in
  `lib/mappers.ts` (Supabase when configured, generator fallback otherwise).
- **Auth:** `src/middleware.ts` gates `/admin` to any signed-in user (single `super_admin` role).
- **Slugs:** `lib/slug.ts`. **Images:** `gallery-images` storage bucket (service-role write, public read).
- **Tests:** Vitest for pure logic (mappers, validation, block/pipeline helpers); Playwright e2e for
  capture→inbox and admin CRUD flows.

## 6. Delivery process

- One feature branch off `main`; one module per spec; commit atomically; verify in preview + `npm run build`.
- Deploy per project convention: `git push origin HEAD:main` (Vercel auto-builds `main`).
- **Prerequisite:** the pending, already-approved working-tree changes (studio-portal removal +
  contact-page Phone/Press removal) should be committed before Phase 1 implementation so the new work
  starts from a clean tree.

## 7. Risks & dependencies

- **Email provider (Resend)** for inquiry alerts/autoresponders — handled as a *pluggable, dormant*
  integration in Phase 1 (activates when a key is added); no hard dependency to ship.
- **Serverless rate-limiting** (Vercel) — in-memory counters don't persist across invocations; Phase 1
  uses a honeypot + a lightweight DB-backed check (see companion spec).
- **RLS** — public tables have `select` policies; writes must stay on the service-role path.
- Replacing generator-only public data (exhibitions) must preserve current public output to avoid regressions.
