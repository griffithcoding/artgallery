# Page Composer — Design (Program + Phase P1)

**Date:** 2026-06-18
**Status:** Approved (design) — pending spec review
**Program context:** This is the "north-star" CMS program — letting the superadmin
**redesign any aspect of a page** from the portal. It supersedes the loose
"block/section composer" item on the roadmap and gives it a concrete shape.

## The program (and why it must be decomposed)

The superadmin gets a page editor with a top **mode bar**:

```
[ Content ]  [ Layout ]  [ Type ]  [ Color ]      [ Preview ]  [ Save ]  [ Publish ]
```

Each mode unlocks a capability, edited **in place** on the rendered page:

- **Content** — edit text & swap images in place
- **Layout** — add / remove / reorder / drag blocks
- **Type** — fonts, sizes, weights (bound to design tokens)
- **Color** — palette / per-section color (bound to design tokens)

**Resolved architecture decisions:**

1. **Curated block stack** (not a free-form x/y canvas). A page is an *ordered list
   of typed blocks*. Rich control within a system; responsive falls out for free;
   robust and hard to visibly break. (How Notion / Sanity / most real Webflow sites
   actually work.)
2. **Data-driven rendering is the keystone.** Today every public page is a hardcoded
   `.astro` template; the mode buttons have nothing to act on. The foundation is
   converting pages to **block trees** rendered by a generic renderer. ~60% of the
   total work; it comes first.
3. **Phased delivery**, each its own spec → plan → build → ship, demoable at every
   step:
   - **P1 — Foundation + Content mode** *(this spec)*
   - **P2 — Layout mode** (add/remove/reorder/drag blocks)
   - **P3 — Type mode** (typography → tokens)
   - **P4 — Color mode** (palette / per-section → tokens)
   - Cross-cutting, woven in: draft↔publish (lands in P1), undo, responsive controls,
     and *migrating real pages* (homepage/About) onto the composer.

This document specifies **P1 only**. The rest are named for context, not designed here.

---

## P1 — Foundation + Content mode

### Goal

Prove the entire composer on a fresh, **zero-risk** page: a superadmin opens a
block-driven page in the portal, changes text & images **in place**, saves a draft,
and publishes it live — with the full mode bar visible (Content wired; Layout/Type/
Color present but disabled "soon"). No existing page is touched.

### Scope boundary (P1 honesty line)

The pilot page is **seeded** with a starter set of blocks. P1 edits the **content of
existing blocks** (their text and images). **Adding / removing / reordering blocks is
Layout mode = P2.** So P1 = "this page is data-driven and its text/images are
editable in place, drafted, and published," not yet "assemble a page from scratch."

### ① Data model / migration (Supabase)

New table, added to `supabase/schema.sql` and applied to the live project:

```sql
create table if not exists public.pages (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title            text not null default '',
  status           text not null default 'draft',      -- 'draft' | 'published'
  blocks           jsonb not null default '[]'::jsonb,  -- working draft
  published_blocks jsonb not null default '[]'::jsonb,  -- what the public sees
  updated_by       uuid,
  updated_at       timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
alter table public.pages enable row level security;
-- Public may read published pages only; writes are service-role/owner (as today).
create policy pages_public_read on public.pages
  for select using (status = 'published');
```

Writes go through the **service-role** client from `/admin` endpoints (same pattern as
artworks/artists), so no broad write policy is needed.

### ② Block model

A page is an ordered array of blocks. A block:

```ts
interface Block {
  id: string;          // stable uuid (for editing + future reorder)
  type: BlockType;     // 'hero' | 'heading' | 'richText' | 'image' | 'worksGrid' | 'quote' | 'spacer'
  props: Record<string, unknown>;  // per-type, validated
}
```

**P1 block library** (props sketched):

| type | props | editable in Content mode |
|---|---|---|
| `hero` | `{ heading, sub, imageUrl }` | heading, sub (text) · imageUrl (swap) |
| `heading` | `{ text, level }` | text |
| `richText` | `{ html }` | inline rich text |
| `image` | `{ url, alt, caption }` | url (swap) · caption (text) |
| `worksGrid` | `{ workIds: string[], cols }` | *(content of works is the catalogue; P1 leaves selection to seed — picking works is P2)* |
| `quote` | `{ text, cite }` | text, cite |
| `spacer` | `{ size }` | *(no content; size is Layout/Type later)* |

A small **pure module** `src/lib/blocks.ts` owns: the `Block`/`BlockType` types, a
`normalizeBlocks()` validator (drops unknown types, fills prop defaults), and
`publish(draftBlocks)` (returns the snapshot to copy into `published_blocks`). Pure →
unit-tested, no I/O.

### ③ Rendering (public + shared)

- `src/lib/pages.ts` — dual-mode read seam mirroring `gallery.ts`:
  `getPage(slug)` and `getPageDraft(slug)` (DB → safe fallback; never throws).
- `src/components/blocks/BlockRenderer.astro` — maps `block.type` → a per-type Astro
  component (`Hero.astro`, `Heading.astro`, `RichText.astro`, `ImageBlock.astro`,
  `WorksGrid.astro` (reuses `ArtworkCard`), `Quote.astro`, `Spacer.astro`). Takes an
  `editable` flag; when true, each editable field is wrapped with `data-block-id` and
  `data-field="text|image"` hooks for the editor island.
- `src/pages/p/[slug].astro` (SSR, `prerender = false`) — public route: renders
  `published_blocks` via `<BlockRenderer editable={false} />`. 404 if no published
  page. Uses the public `Layout.astro` so site nav/footer/brand wrap it.

### ④ Edit surface + Content mode

- `src/pages/admin/pages/[slug].astro` — the editor. **Gated automatically** by the
  existing middleware (`/admin` ⇒ `super_admin` only). Renders the **draft** blocks
  through the same `<BlockRenderer editable={true} />`, inside the real public
  `Layout` so it's true in-place WYSIWYG, plus the mode-bar chrome.
- `src/pages/admin/pages/index.astro` — minimal **read-only list** of pages (links to
  each editor + its public URL). Page *creation* from the UI is **out of P1** — the
  pilot page is seeded (see ⑦).
- `src/scripts/composer.ts` — vanilla-TS editor island (imported via `<script>`, same
  pattern as `admin-upload.ts`). Responsibilities:
  - Render the top mode bar; **Content** active, **Layout/Type/Color** rendered
    disabled with a "soon" affordance; **Preview** toggles the editing chrome off.
  - **Content mode:** make `[data-field=text]` `contenteditable`; clicking
    `[data-field=image]` opens a file picker → `POST /api/upload` (kind `pages`) →
    swaps the `src` and updates the in-memory block JSON.
  - Track a dirty in-memory copy of the blocks; **Save** → `POST /admin/pages/save`
    (draft); **Publish** → `POST /admin/pages/save` with `publish=1`.

### ⑤ Persistence + publish

- `src/pages/admin/pages/save.ts` (POST, under `/admin` ⇒ gated + CSRF-checked by
  middleware). Body = `{ slug, blocks, publish? }`. Validates via
  `normalizeBlocks()`, writes `blocks` (draft); if `publish`, also copies
  draft → `published_blocks` and sets `status='published'`. Stamps `updated_by/at`.
- **Public sees `published_blocks` only** → half-finished drafts never leak.
  Save = safe drafting; Publish = deliberate go-live. Draft/preview/publish from day
  one.

### ⑥ Permissions

Reuses the existing model — **no new auth logic**:
- `/admin/pages/*` (editor + save) → `super_admin` only, via current middleware.
- `/p/[slug]` GET → public, but RLS + the seam only ever expose `published_blocks`.
- CSRF host-Origin check already covers `/admin` + `/api` writes.

### ⑦ Image handling

Reuse `POST /api/upload`. One-line change: add `'pages'` to the `PREFIXES` set in
`src/pages/api/upload.ts` so composer images store under `pages/<uuid>.<ext>` in the
existing `gallery-images` bucket. Same 5 MB image cap, same return `{ url }`.

### ⑧ Seeding the pilot page

A seed (in `supabase/seed.ts` or a one-off script) inserts one `pages` row, e.g.
`slug='studio-demo'`, with a starter block array (hero + heading + richText + image +
worksGrid + quote + spacer), `status='published'`. Gives an immediate public URL
(`/p/studio-demo`) and an editor (`/admin/pages/studio-demo`) to demo end to end.

### Tech approach (and alternative)

Astro SSR for rendering (SEO-clean, matches the whole site) + a lightweight
**vanilla-TS** editor island. *Alternative considered:* a Preact/React island for
richer editor state — **deferred**; Content mode (contenteditable + image swap + a
flat blocks array) doesn't need it, and staying vanilla keeps the bundle lean and
matches `admin-upload.ts`. Revisit when **Layout mode (P2)** needs drag-and-drop —
that's the natural point to introduce a small dnd lib and/or a reactive island.

### Code touch points

- `supabase/schema.sql` — `pages` table + RLS (apply to live DB).
- `src/lib/supabase/types.ts` — `PageRow`.
- `src/lib/blocks.ts` — block types + `normalizeBlocks()` + `publish()` (pure).
- `src/lib/pages.ts` — `getPage()` / `getPageDraft()` dual-mode seam.
- `src/components/blocks/BlockRenderer.astro` + `blocks/*.astro` (7 components).
- `src/pages/p/[slug].astro` — public render.
- `src/pages/admin/pages/index.astro` + `[slug].astro` — editor surface.
- `src/pages/admin/pages/save.ts` — draft/publish endpoint.
- `src/scripts/composer.ts` — editor island (mode bar + Content mode).
- `src/pages/api/upload.ts` — add `pages` prefix.
- `src/styles/admin.css` — mode-bar + editing-affordance styles.
- `supabase/seed.ts` (or one-off) — seed the pilot page.

### Error handling & edge cases

- Missing/unpublished page on `/p/[slug]` → 404 (public). Editor on a non-existent
  slug → "page not found" (no UI create in P1 — pilot page is seeded).
- Unknown/malformed block types → `normalizeBlocks()` drops them; renderer skips
  unknown types. A bad draft can never break the published page (separate column).
- Supabase down / unconfigured → seam falls back safely; public render shows 404
  rather than erroring; editor shows a clear "storage unavailable" state.
- Image upload: rejects non-image / >5 MB with the existing API's messages.
- Concurrent edits: last-write-wins on the draft for P1 (single superadmin); note for
  later if multiple owners edit.

### Testing (TDD)

- **Unit** (`src/lib/blocks.test.ts`): `normalizeBlocks()` fills defaults, drops
  unknown types, preserves order; `publish()` snapshots draft → published.
- **e2e** (Playwright, like the enrichment verification): superadmin opens
  `/admin/pages/studio-demo`, edits a heading + swaps a hero image, **Save** (public
  unchanged), **Publish** (public `/p/studio-demo` now reflects the edit); a
  non-super_admin / logged-out user is redirected away from the editor.

### Verification checklist

- Migration applied; `pages` row seeded; `/p/studio-demo` renders the published blocks
  inside the site shell.
- `/admin/pages/studio-demo` renders the same blocks in-place with the mode bar;
  Layout/Type/Color show disabled.
- Content mode: text becomes editable; image swap uploads + updates.
- Save writes draft only (public unchanged); Publish updates public.
- Non-super_admin blocked from editor + save endpoint.
- Production build passes; unit + e2e green; dev-preview spot check.

### Out of scope (P1)

- Add / remove / reorder / drag blocks (**P2**).
- Typography controls (**P3**); color/palette controls (**P4**).
- Picking works inside `worksGrid` from the UI (P2 — P1 seeds the selection).
- Migrating the real homepage / About onto the composer (later).
- Undo/redo, version history, multi-user editing, page-create wizard, SEO/meta editor
  per page.

### Next sub-projects (named for context)

- **P2 — Layout mode:** block palette (+ add), delete, drag-reorder; likely introduces
  a small dnd lib and a reactive editor island; `worksGrid` work-picker.
- **P3 — Type mode:** typography controls bound to a design-token layer (the existing
  CSS variables in `styles.css` become editable tokens).
- **P4 — Color mode:** palette + per-section color, also token-bound.
- **Migration:** rebuild homepage/About as block trees once the system is proven —
  finally making the hardcoded "Selected works" masonry CMS-editable.
