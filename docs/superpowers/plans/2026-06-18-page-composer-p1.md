# Page Composer P1 (Foundation + Content Mode) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a fresh, block-driven page (`/p/studio-demo`) that a superadmin can edit in place (text + images), save as a draft, and publish live — proving the composer foundation without touching any existing page.

**Architecture:** Pages are stored in Supabase as ordered arrays of typed blocks (`pages.blocks` draft + `pages.published_blocks` live). A pure `blocks.ts` module owns the block types, validation, and the draft→publish snapshot. A shared `BlockRenderer.astro` maps block types to small Astro components and renders both the public route (`/p/[slug]`, published) and the superadmin editor (`/admin/pages/[slug]`, draft). A vanilla-TS island (`composer.ts`) adds the top mode bar and Content-mode editing (contenteditable + image swap via the existing `/api/upload`). All gating reuses the current `/admin` `super_admin` middleware.

**Tech Stack:** Astro 5 (SSR, `prerender = false`), Supabase (`@supabase/supabase-js`), Vitest (unit), Playwright (e2e), vanilla TypeScript client island. No new runtime deps.

---

## File Structure

**Create:**
- `src/lib/blocks.ts` — block types, `normalizeBlocks()`, `publish()` (pure, no I/O)
- `src/lib/blocks.test.ts` — unit tests for the above
- `src/lib/pages.ts` — dual-mode read seam: `getPage()`, `getPageDraft()`, pure `pageRowToBlocks()`
- `src/lib/pages.test.ts` — unit test for `pageRowToBlocks()`
- `src/components/blocks/BlockRenderer.astro` — type → component dispatch
- `src/components/blocks/Hero.astro`, `Heading.astro`, `RichText.astro`, `ImageBlock.astro`, `WorksGrid.astro`, `Quote.astro`, `Spacer.astro`
- `src/pages/p/[slug].astro` — public render (published blocks)
- `src/pages/admin/pages/index.astro` — read-only page list
- `src/pages/admin/pages/[slug].astro` — superadmin in-place editor
- `src/pages/admin/pages/save.ts` — draft/publish POST endpoint
- `src/scripts/composer.ts` — editor island (mode bar + Content mode)
- `supabase/seed-page.ts` — one-off: seed the `studio-demo` page
- `scripts/e2e-composer.mjs` — Playwright end-to-end verification

**Modify:**
- `src/lib/supabase/types.ts` — add `PageRow`
- `supabase/schema.sql` — add `pages` table + RLS (also applied to live DB)
- `src/pages/api/upload.ts:9` — add `'pages'` to `PREFIXES`
- `src/styles/admin.css` — append mode-bar + editing styles

---

## Task 1: Block model (pure, TDD)

**Files:**
- Create: `src/lib/blocks.ts`
- Test: `src/lib/blocks.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/blocks.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeBlocks, publish, BLOCK_TYPES } from './blocks';

describe('normalizeBlocks', () => {
  it('fills prop defaults for a known type', () => {
    const out = normalizeBlocks([{ id: 'a', type: 'heading', props: {} }]);
    expect(out).toEqual([{ id: 'a', type: 'heading', props: { text: '', level: 2 } }]);
  });

  it('preserves provided props over defaults', () => {
    const out = normalizeBlocks([{ id: 'h', type: 'hero', props: { heading: 'Hi' } }]);
    expect(out[0].props).toEqual({ heading: 'Hi', sub: '', imageUrl: '' });
  });

  it('drops unknown block types', () => {
    const out = normalizeBlocks([{ id: 'x', type: 'bogus', props: {} } as any]);
    expect(out).toEqual([]);
  });

  it('preserves order and fills a missing id deterministically', () => {
    const out = normalizeBlocks([
      { type: 'spacer', props: {} } as any,
      { id: 'q', type: 'quote', props: {} },
    ]);
    expect(out.map((b) => b.id)).toEqual(['b-0', 'q']);
  });

  it('coerces a non-array to []', () => {
    expect(normalizeBlocks(null as any)).toEqual([]);
  });

  it('exposes all seven block types', () => {
    expect([...BLOCK_TYPES].sort()).toEqual(
      ['hero', 'heading', 'richText', 'image', 'worksGrid', 'quote', 'spacer'].sort()
    );
  });
});

describe('publish', () => {
  it('returns a normalized deep clone (no shared refs)', () => {
    const draft = [{ id: 'a', type: 'heading', props: { text: 'X', level: 3 } }];
    const snap = publish(draft);
    expect(snap).toEqual([{ id: 'a', type: 'heading', props: { text: 'X', level: 3 } }]);
    (snap[0].props as any).text = 'Y';
    expect(draft[0].props.text).toBe('X'); // original untouched
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/blocks.test.ts`
Expected: FAIL — `Cannot find module './blocks'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/blocks.ts
// Pure block model for the page composer. No I/O — unit-tested.

export type BlockType =
  | 'hero' | 'heading' | 'richText' | 'image' | 'worksGrid' | 'quote' | 'spacer';

export const BLOCK_TYPES: readonly BlockType[] = [
  'hero', 'heading', 'richText', 'image', 'worksGrid', 'quote', 'spacer',
] as const;

export interface Block {
  id: string;
  type: BlockType;
  props: Record<string, unknown>;
}

// Per-type prop defaults. normalizeBlocks merges these under provided props.
const DEFAULTS: Record<BlockType, Record<string, unknown>> = {
  hero: { heading: '', sub: '', imageUrl: '' },
  heading: { text: '', level: 2 },
  richText: { html: '' },
  image: { url: '', alt: '', caption: '' },
  worksGrid: { workIds: [], cols: 3 },
  quote: { text: '', cite: '' },
  spacer: { size: 'md' },
};

function isBlockType(t: unknown): t is BlockType {
  return typeof t === 'string' && (BLOCK_TYPES as readonly string[]).includes(t);
}

/** Coerce arbitrary input into a clean Block[]: drop unknown types, fill defaults,
 *  preserve order, and assign a deterministic id when one is missing. */
export function normalizeBlocks(input: unknown): Block[] {
  if (!Array.isArray(input)) return [];
  const out: Block[] = [];
  input.forEach((raw, i) => {
    if (!raw || typeof raw !== 'object') return;
    const r = raw as Partial<Block>;
    if (!isBlockType(r.type)) return;
    const id = typeof r.id === 'string' && r.id ? r.id : `b-${i}`;
    const props = { ...DEFAULTS[r.type], ...(r.props ?? {}) };
    out.push({ id, type: r.type, props });
  });
  return out;
}

/** Snapshot a draft for publishing: normalized deep clone (no shared references). */
export function publish(draft: unknown): Block[] {
  return normalizeBlocks(JSON.parse(JSON.stringify(normalizeBlocks(draft))));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/blocks.test.ts`
Expected: PASS (all in `blocks.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/blocks.ts src/lib/blocks.test.ts
git commit -m "feat(composer): pure block model — types, normalize, publish"
```

---

## Task 2: DB schema + PageRow type

**Files:**
- Modify: `supabase/schema.sql` (append)
- Modify: `src/lib/supabase/types.ts` (append interface)

- [ ] **Step 1: Add the `pages` table to `supabase/schema.sql`**

Append:

```sql
-- ── Pages (composer) ────────────────────────────────────────────────────────
create table if not exists public.pages (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title            text not null default '',
  status           text not null default 'draft',       -- 'draft' | 'published'
  blocks           jsonb not null default '[]'::jsonb,   -- working draft
  published_blocks jsonb not null default '[]'::jsonb,   -- public-facing
  updated_by       uuid,
  updated_at       timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
alter table public.pages enable row level security;
drop policy if exists pages_public_read on public.pages;
create policy pages_public_read on public.pages
  for select using (status = 'published');
-- Writes use the service-role client from /admin endpoints (bypasses RLS).
```

- [ ] **Step 2: Add `PageRow` to `src/lib/supabase/types.ts`**

Append after `PressMentionRow`:

```ts
export interface PageRow {
  id: string; slug: string; title: string;
  status: 'draft' | 'published';
  blocks: unknown;            // Block[] as jsonb
  published_blocks: unknown;  // Block[] as jsonb
  updated_by: string | null; updated_at: string; created_at: string;
}
```

- [ ] **Step 3: Apply the migration to the live Supabase project**

Run (reads `.env`):

```bash
PUBLIC_SUPABASE_URL=$(grep -oP '^PUBLIC_SUPABASE_URL=\K.*' .env) npx -y tsx -e "
import { createClient } from '@supabase/supabase-js';
process.loadEnvFile();
const sb = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { error } = await sb.rpc('exec_sql', {}); // no-op probe
console.log('Apply the pages DDL via Supabase SQL editor or psql.');
"
```

> NOTE: This project applies SQL via the Supabase SQL editor (see `supabase/README.md`). Paste the `pages` DDL from Step 1 into the SQL editor and run it. Verify with: `select count(*) from public.pages;` returning `0`.

- [ ] **Step 4: Verify the build still compiles**

Run: `npm run build`
Expected: build succeeds (type addition only).

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql src/lib/supabase/types.ts
git commit -m "feat(composer): pages table + PageRow type"
```

---

## Task 3: Page read seam (TDD for the pure mapper)

**Files:**
- Create: `src/lib/pages.ts`
- Test: `src/lib/pages.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/pages.test.ts
import { describe, it, expect } from 'vitest';
import { pageRowToBlocks } from './pages';

describe('pageRowToBlocks', () => {
  it('reads the published column by default and normalizes', () => {
    const row = {
      published_blocks: [{ id: 'a', type: 'heading', props: { text: 'Live' } }],
      blocks: [{ id: 'b', type: 'heading', props: { text: 'Draft' } }],
    } as any;
    expect(pageRowToBlocks(row, 'published')).toEqual([
      { id: 'a', type: 'heading', props: { text: 'Live', level: 2 } },
    ]);
  });

  it('reads the draft column when asked', () => {
    const row = {
      published_blocks: [],
      blocks: [{ id: 'b', type: 'heading', props: { text: 'Draft' } }],
    } as any;
    expect(pageRowToBlocks(row, 'draft')[0].props.text).toBe('Draft');
  });

  it('tolerates a null/garbage column', () => {
    expect(pageRowToBlocks({ published_blocks: null } as any, 'published')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/pages.test.ts`
Expected: FAIL — `Cannot find module './pages'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/pages.ts
// Dual-mode read seam for composer pages (mirrors gallery.ts). On any DB error or
// when Supabase is unconfigured, callers get null/[] — the site never breaks.
import { createSupabaseAnon, createSupabaseAdmin, isSupabaseConfigured } from './supabase/server';
import { normalizeBlocks, type Block } from './blocks';
import type { PageRow } from './supabase/types';

export interface Page { slug: string; title: string; blocks: Block[]; }

/** Pure: pick a column from a row and normalize it to Block[]. */
export function pageRowToBlocks(row: Pick<PageRow, 'blocks' | 'published_blocks'>, which: 'draft' | 'published'): Block[] {
  return normalizeBlocks(which === 'draft' ? row.blocks : row.published_blocks);
}

/** Public: the published page, or null. */
export async function getPage(slug: string): Promise<Page | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createSupabaseAnon();
    const { data, error } = await sb.from('pages').select('*').eq('slug', slug).eq('status', 'published').maybeSingle();
    if (error || !data) return null;
    const row = data as PageRow;
    return { slug: row.slug, title: row.title, blocks: pageRowToBlocks(row, 'published') };
  } catch {
    return null;
  }
}

/** Editor: the draft (service-role; superadmin endpoints only). */
export async function getPageDraft(slug: string): Promise<Page | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createSupabaseAdmin();
    const { data, error } = await sb.from('pages').select('*').eq('slug', slug).maybeSingle();
    if (error || !data) return null;
    const row = data as PageRow;
    return { slug: row.slug, title: row.title, blocks: pageRowToBlocks(row, 'draft') };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/pages.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pages.ts src/lib/pages.test.ts
git commit -m "feat(composer): page read seam (dual-mode) + pure mapper"
```

---

## Task 4: Block components + BlockRenderer

**Files:**
- Create: `src/components/blocks/Hero.astro`, `Heading.astro`, `RichText.astro`, `ImageBlock.astro`, `WorksGrid.astro`, `Quote.astro`, `Spacer.astro`, `BlockRenderer.astro`

> Each editable field carries `data-block-id`, `data-field` ("text" | "image"), and
> `data-prop` (the block prop key) so `composer.ts` can bind edits to block JSON.
> These attributes are inert without the editor island (safe on public pages).

- [ ] **Step 1: Create the leaf block components**

```astro
---
// src/components/blocks/Hero.astro
const { id, props } = Astro.props;
const { heading = '', sub = '', imageUrl = '' } = props ?? {};
---
<section class="cb-hero" style={imageUrl ? `background-image:url('${imageUrl}')` : ''}>
  <img class="cb-hero-bg" data-block-id={id} data-field="image" data-prop="imageUrl" src={imageUrl} alt={heading} hidden={!imageUrl} />
  <div class="cb-hero-inner wrap">
    <h1 class="display" data-block-id={id} data-field="text" data-prop="heading">{heading}</h1>
    <p class="lead" data-block-id={id} data-field="text" data-prop="sub">{sub}</p>
  </div>
</section>
```

```astro
---
// src/components/blocks/Heading.astro
const { id, props } = Astro.props;
const { text = '', level = 2 } = props ?? {};
const Tag = `h${[1,2,3,4].includes(Number(level)) ? level : 2}`;
---
<div class="wrap"><Tag class="display cb-heading" data-block-id={id} data-field="text" data-prop="text">{text}</Tag></div>
```

```astro
---
// src/components/blocks/RichText.astro
const { id, props } = Astro.props;
const { html = '' } = props ?? {};
---
<div class="wrap"><div class="prose cb-richtext" data-block-id={id} data-field="text" data-prop="html" set:html={html} /></div>
```

```astro
---
// src/components/blocks/ImageBlock.astro
const { id, props } = Astro.props;
const { url = '', alt = '', caption = '' } = props ?? {};
---
<figure class="wrap cb-image">
  <img data-block-id={id} data-field="image" data-prop="url" src={url} alt={alt} />
  <figcaption data-block-id={id} data-field="text" data-prop="caption">{caption}</figcaption>
</figure>
```

```astro
---
// src/components/blocks/WorksGrid.astro
import { getArtworks } from '../../lib/gallery';
import ArtworkCard from '../ArtworkCard.astro';
const { props } = Astro.props;
const { workIds = [], cols = 3 } = props ?? {};
const all = await getArtworks();
const ids = Array.isArray(workIds) ? workIds : [];
const works = ids.map((wid) => all.find((w) => w.id === wid)).filter(Boolean);
const gridClass = `grid grid--${[2,3,4].includes(Number(cols)) ? cols : 3}`;
---
<div class="wrap"><div class={gridClass}>{works.map((w) => <ArtworkCard work={w} />)}</div></div>
```

```astro
---
// src/components/blocks/Quote.astro
const { id, props } = Astro.props;
const { text = '', cite = '' } = props ?? {};
---
<blockquote class="wrap cb-quote">
  <p class="display" data-block-id={id} data-field="text" data-prop="text">{text}</p>
  <cite data-block-id={id} data-field="text" data-prop="cite">{cite}</cite>
</blockquote>
```

```astro
---
// src/components/blocks/Spacer.astro
const { props } = Astro.props;
const sizes = { sm: '1.5rem', md: '3.5rem', lg: '6rem' };
const h = sizes[props?.size] ?? sizes.md;
---
<div class="cb-spacer" style={`height:${h}`} aria-hidden="true"></div>
```

- [ ] **Step 2: Create `BlockRenderer.astro`**

```astro
---
// src/components/blocks/BlockRenderer.astro — block.type → component dispatch.
import Hero from './Hero.astro';
import Heading from './Heading.astro';
import RichText from './RichText.astro';
import ImageBlock from './ImageBlock.astro';
import WorksGrid from './WorksGrid.astro';
import Quote from './Quote.astro';
import Spacer from './Spacer.astro';
import type { Block } from '../../lib/blocks';

const MAP = { hero: Hero, heading: Heading, richText: RichText, image: ImageBlock, worksGrid: WorksGrid, quote: Quote, spacer: Spacer } as const;
const { blocks = [] } = Astro.props as { blocks: Block[] };
---
{blocks.map((b) => {
  const C = (MAP as Record<string, any>)[b.type];
  return C ? <C id={b.id} props={b.props} /> : null;
})}
```

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds (components compile; no route uses them yet).

- [ ] **Step 4: Commit**

```bash
git add src/components/blocks/
git commit -m "feat(composer): block components + BlockRenderer dispatch"
```

---

## Task 5: Public route `/p/[slug]`

**Files:**
- Create: `src/pages/p/[slug].astro`

- [ ] **Step 1: Create the public render route**

```astro
---
export const prerender = false;
import Layout from '../../layouts/Layout.astro';
import BlockRenderer from '../../components/blocks/BlockRenderer.astro';
import { getPage } from '../../lib/pages';

const { slug } = Astro.params;
const page = await getPage(slug!);
if (!page) return new Response(null, { status: 404 });
---
<Layout title={`${page.title} — Mazlish + Wright Contemporary`}>
  <main><BlockRenderer blocks={page.blocks} /></main>
</Layout>
```

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds; `/p/[slug]` appears as an SSR route.

- [ ] **Step 3: Commit**

```bash
git add src/pages/p/
git commit -m "feat(composer): public /p/[slug] render route"
```

---

## Task 6: Upload API — add `pages` prefix

**Files:**
- Modify: `src/pages/api/upload.ts:9`

- [ ] **Step 1: Add `'pages'` to the allowed prefixes**

Change line 9 from:

```ts
const PREFIXES = new Set(['artworks', 'artists', 'posts', 'cv']);
```

to:

```ts
const PREFIXES = new Set(['artworks', 'artists', 'posts', 'cv', 'pages']);
```

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/upload.ts
git commit -m "feat(composer): allow 'pages' image upload prefix"
```

---

## Task 7: Save / publish endpoint

**Files:**
- Create: `src/pages/admin/pages/save.ts`

- [ ] **Step 1: Create the endpoint**

```ts
// src/pages/admin/pages/save.ts — superadmin only (gated by middleware + CSRF).
import type { APIRoute } from 'astro';
import { createSupabaseAdmin } from '../../../lib/supabase/server';
import { normalizeBlocks, publish } from '../../../lib/blocks';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || user.role !== 'super_admin') return new Response('Forbidden', { status: 403 });

  let body: { slug?: string; blocks?: unknown; publish?: boolean };
  try { body = await request.json(); } catch { return new Response('Bad JSON', { status: 400 }); }
  const slug = String(body.slug ?? '');
  if (!slug) return new Response('Missing slug', { status: 400 });

  const draft = normalizeBlocks(body.blocks);
  const patch: Record<string, unknown> = { blocks: draft, updated_by: user.id, updated_at: new Date().toISOString() };
  if (body.publish) { patch.published_blocks = publish(draft); patch.status = 'published'; }

  const sb = createSupabaseAdmin();
  const { error } = await sb.from('pages').update(patch).eq('slug', slug);
  if (error) return new Response(error.message, { status: 500 });
  return new Response(JSON.stringify({ ok: true, published: Boolean(body.publish) }), {
    status: 200, headers: { 'content-type': 'application/json' },
  });
};
```

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds; `/admin/pages/save` is an SSR endpoint.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/pages/save.ts
git commit -m "feat(composer): draft/publish save endpoint (super_admin)"
```

---

## Task 8: Editor pages (`/admin/pages`)

**Files:**
- Create: `src/pages/admin/pages/index.astro`
- Create: `src/pages/admin/pages/[slug].astro`

- [ ] **Step 1: Create the read-only page list**

```astro
---
export const prerender = false;
import AdminLayout from '../../../layouts/AdminLayout.astro';
import { createSupabaseAdmin, isSupabaseConfigured } from '../../../lib/supabase/server';

let pages: { slug: string; title: string; status: string }[] = [];
if (isSupabaseConfigured()) {
  try {
    const sb = createSupabaseAdmin();
    const { data } = await sb.from('pages').select('slug, title, status').order('updated_at', { ascending: false });
    pages = data ?? [];
  } catch { /* storage unavailable */ }
}
---
<AdminLayout title="Pages">
  <h1 style="font-weight:400;">Pages</h1>
  <p style="color:#6b6860;max-width:60ch;">Composer pages. Edit in place, then publish. (Creating new pages from here arrives with Layout mode.)</p>
  {pages.length === 0
    ? <p style="color:#6b6860;">No composer pages yet — seed one with <code>supabase/seed-page.ts</code>.</p>
    : <ul>{pages.map((p) => (
        <li style="margin:.4rem 0;">
          <a class="admin-btn" href={`/admin/pages/${p.slug}`}>Edit “{p.title || p.slug}”</a>
          <a href={`/p/${p.slug}`} target="_blank" style="margin-left:.6rem;">view ↗</a>
          <span style="margin-left:.6rem;color:#8a8675;">{p.status}</span>
        </li>))}</ul>}
</AdminLayout>
```

- [ ] **Step 2: Create the in-place editor**

> Renders the **public** `Layout` (true WYSIWYG) + the draft blocks + a JSON island
> payload + `composer.ts`. Middleware already restricts `/admin/*` to `super_admin`.

```astro
---
export const prerender = false;
import Layout from '../../../layouts/Layout.astro';
import BlockRenderer from '../../../components/blocks/BlockRenderer.astro';
import { getPageDraft } from '../../../lib/pages';

const { slug } = Astro.params;
const page = await getPageDraft(slug!);
if (!page) return new Response('Page not found', { status: 404 });
---
<Layout title={`Editing: ${page.title}`}>
  <div id="composer-root" data-slug={page.slug}>
    <main><BlockRenderer blocks={page.blocks} /></main>
  </div>
  <script type="application/json" id="composer-blocks" set:html={JSON.stringify(page.blocks)}></script>
  <script>import '../../../scripts/composer.ts';</script>
</Layout>
```

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds; `/admin/pages` and `/admin/pages/[slug]` are SSR routes.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/pages/index.astro src/pages/admin/pages/[slug].astro
git commit -m "feat(composer): admin page list + in-place editor shell"
```

---

## Task 9: Composer editor island (mode bar + Content mode)

**Files:**
- Create: `src/scripts/composer.ts`

- [ ] **Step 1: Create the island**

```ts
// src/scripts/composer.ts — superadmin in-place editor. Loaded only on /admin/pages/[slug].
// Builds the top mode bar; Content mode wires contenteditable text + image swap.
interface Block { id: string; type: string; props: Record<string, unknown>; }

const root = document.getElementById('composer-root');
const dataEl = document.getElementById('composer-blocks');
if (root && dataEl) {
  const slug = root.dataset.slug!;
  const state: Block[] = JSON.parse(dataEl.textContent || '[]');
  const byId = new Map(state.map((b) => [b.id, b]));

  // ---- top mode bar ----
  const bar = document.createElement('div');
  bar.className = 'composer-bar';
  bar.innerHTML = `
    <span class="composer-brand">Composer</span>
    <button data-mode="content" class="composer-mode is-active">Content</button>
    <button class="composer-mode" disabled title="Coming in Layout mode">Layout</button>
    <button class="composer-mode" disabled title="Coming in Type mode">Type</button>
    <button class="composer-mode" disabled title="Coming in Color mode">Color</button>
    <span class="composer-spacer"></span>
    <button class="composer-mode" id="composer-preview">Preview</button>
    <button class="composer-btn" id="composer-save">Save</button>
    <button class="composer-btn composer-btn--solid" id="composer-publish">Publish</button>
    <span class="composer-status" id="composer-status"></span>`;
  document.body.appendChild(bar);
  document.body.classList.add('composer-on');
  const status = bar.querySelector('#composer-status') as HTMLElement;

  // ---- content mode: editable text ----
  const textEls = root.querySelectorAll<HTMLElement>('[data-field="text"]');
  textEls.forEach((el) => {
    el.contentEditable = 'true';
    el.classList.add('composer-editable');
    el.addEventListener('input', () => {
      const b = byId.get(el.dataset.blockId!);
      if (!b) return;
      const prop = el.dataset.prop!;
      b.props[prop] = prop === 'html' ? el.innerHTML : el.textContent ?? '';
    });
  });

  // ---- content mode: image swap ----
  const filePicker = document.createElement('input');
  filePicker.type = 'file';
  filePicker.accept = 'image/jpeg,image/png,image/webp';
  filePicker.style.display = 'none';
  document.body.appendChild(filePicker);
  let activeImg: HTMLImageElement | null = null;

  root.querySelectorAll<HTMLImageElement>('[data-field="image"]').forEach((img) => {
    img.classList.add('composer-editable-img');
    img.style.cursor = 'pointer';
    img.addEventListener('click', () => { activeImg = img; filePicker.click(); });
  });

  filePicker.addEventListener('change', async () => {
    const file = filePicker.files?.[0];
    if (!file || !activeImg) return;
    status.textContent = 'Uploading…';
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', 'pages');
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) { status.textContent = 'Upload failed.'; return; }
      const { url } = await res.json();
      activeImg.src = url;
      activeImg.hidden = false;
      const b = byId.get(activeImg.dataset.blockId!);
      if (b) b.props[activeImg.dataset.prop!] = url;
      status.textContent = 'Image updated ✓';
    } catch { status.textContent = 'Upload failed.'; }
    filePicker.value = '';
  });

  // ---- save / publish ----
  async function send(publish: boolean) {
    status.textContent = publish ? 'Publishing…' : 'Saving…';
    try {
      const res = await fetch('/admin/pages/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, blocks: state, publish }),
      });
      status.textContent = res.ok ? (publish ? 'Published ✓' : 'Saved ✓') : 'Save failed.';
    } catch { status.textContent = 'Save failed.'; }
  }
  bar.querySelector('#composer-save')!.addEventListener('click', () => send(false));
  bar.querySelector('#composer-publish')!.addEventListener('click', () => send(true));

  // ---- preview toggle ----
  bar.querySelector('#composer-preview')!.addEventListener('click', () => {
    const on = document.body.classList.toggle('composer-preview');
    textEls.forEach((el) => (el.contentEditable = on ? 'false' : 'true'));
  });
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds (TS compiles; island bundled).

- [ ] **Step 3: Commit**

```bash
git add src/scripts/composer.ts
git commit -m "feat(composer): editor island — mode bar, content edit, image swap, save/publish"
```

---

## Task 10: Mode-bar + editing styles

**Files:**
- Modify: `src/styles/admin.css` (append)

- [ ] **Step 1: Append composer styles**

```css
/* ── Page composer ─────────────────────────────────────────────── */
body.composer-on { padding-bottom: 64px; }
.composer-bar {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 9999;
  display: flex; align-items: center; gap: .5rem;
  padding: .55rem 1rem; background: #1b2233; color: #f3ede2;
  font: 500 .85rem/1 ui-sans-serif, Inter, Arial, sans-serif;
  box-shadow: 0 -4px 18px rgba(0,0,0,.25);
}
.composer-brand { font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: #e7b9ad; margin-right: .5rem; }
.composer-spacer { flex: 1; }
.composer-mode, .composer-btn {
  border: 1px solid rgba(243,237,226,.25); background: transparent; color: inherit;
  padding: .4rem .8rem; border-radius: 999px; cursor: pointer;
}
.composer-mode.is-active { background: #8a2b1f; border-color: #8a2b1f; }
.composer-mode[disabled] { opacity: .4; cursor: not-allowed; }
.composer-btn--solid { background: #f3ede2; color: #1b2233; border-color: #f3ede2; }
.composer-status { margin-left: .5rem; color: #cdd3df; min-width: 8ch; }
.composer-editable:focus { outline: 2px dashed #8a2b1f; outline-offset: 3px; }
.composer-editable-img { outline: 2px dashed rgba(138,43,31,.6); outline-offset: 3px; }
body.composer-preview .composer-editable:focus { outline: none; }
body.composer-preview .composer-editable-img { outline: none; cursor: default; }
```

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/styles/admin.css
git commit -m "feat(composer): mode-bar + editing affordance styles"
```

---

## Task 11: Seed the pilot page

**Files:**
- Create: `supabase/seed-page.ts`

- [ ] **Step 1: Create the seed script**

```ts
// supabase/seed-page.ts — one-off: insert/refresh the 'studio-demo' composer page.
// Run: npx -y tsx supabase/seed-page.ts   (reads .env)
import { createClient } from '@supabase/supabase-js';
process.loadEnvFile();
const sb = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// Pull a few real artwork ids for the works grid.
const { data: works } = await sb.from('artworks').select('id').limit(3);
const workIds = (works ?? []).map((w) => w.id);

const blocks = [
  { id: 'hero-1', type: 'hero', props: { heading: 'Studio Demo', sub: 'A page built with the composer', imageUrl: '' } },
  { id: 'head-1', type: 'heading', props: { text: 'About this page', level: 2 } },
  { id: 'rt-1', type: 'richText', props: { html: '<p>This page is rendered entirely from editable blocks. Toggle Content mode to change this text in place.</p>' } },
  { id: 'img-1', type: 'image', props: { url: '', alt: '', caption: 'Click to swap this image' } },
  { id: 'grid-1', type: 'worksGrid', props: { workIds, cols: 3 } },
  { id: 'quote-1', type: 'quote', props: { text: 'Design is intelligence made visible.', cite: '— Alina Wheeler' } },
  { id: 'sp-1', type: 'spacer', props: { size: 'lg' } },
];

const row = { slug: 'studio-demo', title: 'Studio Demo', status: 'published', blocks, published_blocks: blocks };
const { error } = await sb.from('pages').upsert(row, { onConflict: 'slug' });
if (error) { console.error('seed failed:', error.message); process.exit(1); }
console.log('Seeded /p/studio-demo (editor: /admin/pages/studio-demo)');
```

- [ ] **Step 2: Run the seed (after the migration in Task 2 is applied)**

Run: `npx -y tsx supabase/seed-page.ts`
Expected: `Seeded /p/studio-demo …`.

- [ ] **Step 3: Commit**

```bash
git add supabase/seed-page.ts
git commit -m "feat(composer): seed studio-demo pilot page"
```

---

## Task 12: End-to-end verification (Playwright)

**Files:**
- Create: `scripts/e2e-composer.mjs`

- [ ] **Step 1: Create the e2e script**

```js
// scripts/e2e-composer.mjs — verify edit → save (public unchanged) → publish (public updated) + auth gate.
// Run: OWNER_PW='Owner2026!' node scripts/e2e-composer.mjs   (dev server on :4321)
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:4321';
const OWNER = { email: process.env.OWNER_EMAIL || 'wgriffith1218@gmail.com', password: process.env.OWNER_PW };
const stamp = `Edited ${process.env.STAMP || Math.floor(Number(process.env.SEED || '424242'))}`;
const fail = (m) => { console.error('FAIL:', m); process.exit(1); };

const browser = await chromium.launch();

// 1) auth gate: logged-out editor access redirects to login
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/admin/pages/studio-demo`, { waitUntil: 'networkidle' });
  if (!page.url().includes('/admin/login')) fail('logged-out editor not redirected to login');
  await ctx.close();
  console.log('OK gate: logged-out → login');
}

// 2) login, edit heading, SAVE (draft) — public must NOT change
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle' });
await page.fill('#email', OWNER.email);
await page.fill('#password', OWNER.password);
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}), page.click('button[type=submit]')]);

await page.goto(`${BASE}/admin/pages/studio-demo`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800); // composer island mounts
const headingSel = '[data-block-id="head-1"][data-field="text"]';
await page.click(headingSel);
await page.evaluate(({ sel, text }) => {
  const el = document.querySelector(sel);
  el.textContent = text;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}, { sel: headingSel, text: stamp });
await page.click('#composer-save');
await page.waitForTimeout(800);

const pub1 = await ctx.newPage();
await pub1.goto(`${BASE}/p/studio-demo`, { waitUntil: 'networkidle' });
if ((await pub1.content()).includes(stamp)) fail('public reflected an unpublished draft');
console.log('OK save: draft did NOT leak to public');

// 3) PUBLISH — public must now reflect the edit
await page.bringToFront();
await page.click('#composer-publish');
await page.waitForTimeout(900);
await pub1.goto(`${BASE}/p/studio-demo`, { waitUntil: 'networkidle' });
if (!(await pub1.content()).includes(stamp)) fail('public did NOT reflect the published edit');
console.log('OK publish: public reflects the edit');

await browser.close();
console.log('E2E PASSED');
```

- [ ] **Step 2: Run unit tests + build**

Run: `npm test && npm run build`
Expected: all unit tests pass; build succeeds.

- [ ] **Step 3: Run the e2e (dev server running, migration applied, page seeded)**

Run (two shells): `npm run dev` then `OWNER_PW='Owner2026!' node scripts/e2e-composer.mjs`
Expected: `OK gate…`, `OK save…`, `OK publish…`, `E2E PASSED`.

> NOTE: `Owner2026!` is the current test password (flagged for rotation). Pass it via env, do not hardcode.

- [ ] **Step 4: Commit**

```bash
git add scripts/e2e-composer.mjs
git commit -m "test(composer): e2e edit→save→publish + auth gate"
```

---

## Self-Review

**Spec coverage:**
- ① data model → Task 2 ✓ · ② block model → Task 1 ✓ · ③ rendering (seam + renderer + public route) → Tasks 3,4,5 ✓ · ④ editor + Content mode → Tasks 8,9 ✓ · ⑤ persistence/publish → Task 7 ✓ · ⑥ permissions → reused middleware + endpoint role check (Task 7) ✓ · ⑦ image handling → Task 6 ✓ · ⑧ seed → Task 11 ✓ · tech approach (vanilla island) → Task 9 ✓ · testing (unit + e2e) → Tasks 1,3,12 ✓.
- Out-of-scope items (add/remove/reorder, Type, Color, work-picker, page-create UI) are intentionally absent — confirmed not implemented.

**Placeholder scan:** No TBD/TODO; every code step has full code; every command has expected output. The only manual step is applying the SQL migration (Task 2 Step 3) — unavoidable, this project runs DDL via the Supabase SQL editor per `supabase/README.md`.

**Type consistency:** `Block { id, type, props }` identical across `blocks.ts`, `composer.ts`, `BlockRenderer`, and `save.ts`. `normalizeBlocks`/`publish` signatures match Task 1 usage in Tasks 3 & 7. `data-block-id`/`data-field`/`data-prop` hooks emitted by components (Task 4) match exactly what `composer.ts` queries (Task 9). Block ids in the seed (`head-1`, etc., Task 11) match the e2e selector `[data-block-id="head-1"]` (Task 12).
