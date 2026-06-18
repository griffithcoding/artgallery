# Artist Records Enrichment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich artist records with representation/career/contact facts + a CV PDF + a `featured` flag, surfaced across the public artist page, owner admin, and creator Studio.

**Architecture:** Add nullable columns to the Supabase `artists` table; expose them through the dual-mode data seam (`gallery.ts` → `rowToArtist`); owner edits representation/curation facts, the artist edits self-description (incl. nationality, owner-hidden) from the Studio; the public page renders a credentials block. CV PDFs reuse the existing `/api/upload` flow. Pure logic (year math, URL normalising, row mapping) is unit-tested; SSR/forms/upload are verified by build + an authenticated screenshot pass.

**Tech Stack:** Astro 5 (SSR, Vercel adapter), Supabase (`@supabase/supabase-js`, `@supabase/ssr`), vitest, the Warm Atelier `admin.css` theme (already shipped).

Spec: `docs/superpowers/specs/2026-06-18-artist-records-enrichment-design.md`.

---

## File structure

| File | Responsibility | Action |
|---|---|---|
| `supabase/schema.sql` | schema of record | modify (add columns) |
| `src/lib/supabase/types.ts` | `ArtistRow` DB type | modify |
| `src/lib/gallery.ts` | `Artist` type, data seam, `getArtists` order, `getArtistWorkCounts` | modify |
| `src/lib/mappers.ts` | `rowToArtist` | modify |
| `src/lib/artistMeta.ts` | pure helpers: `yearsActive`, `normalizeUrl`, `instagramUrl` | **create** |
| `src/lib/artistMeta.test.ts` | unit tests for helpers | **create** |
| `src/lib/mappers.test.ts` | unit test for `rowToArtist` new fields | **create** |
| `src/pages/api/upload.ts` | upload endpoint (+ `cv` PDF kind) | modify |
| `src/scripts/admin-upload.ts` | client upload (PDF handling) | modify |
| `src/pages/admin/artists/[id].astro` | owner edit form | modify |
| `src/pages/admin/artists/save.ts` | owner persist | modify |
| `src/pages/studio/profile/index.astro` | creator profile form | modify |
| `src/pages/studio/profile/save.ts` | creator persist | modify |
| `src/pages/artists/[slug].astro` | public credentials block | modify |
| `src/pages/admin/artists/index.astro` | owner list (counts, featured) | modify |
| `src/pages/artists/index.astro` | public list (featured badge) | modify |
| `src/styles/styles.css` | public credentials/badge styles | modify |

---

### Task 1: Database migration

**Files:** Modify `supabase/schema.sql`

- [ ] **Step 1: Add columns to the `artists` create-table block** in `supabase/schema.sql` (after the existing `bio text default ''` / `portrait_image_url text` lines, before `created_at`):

```sql
  represented_since int,
  active_since int,
  based_in text default '',
  website_url text default '',
  instagram_url text default '',
  education text default '',
  nationality text default '',
  cv_url text default '',
  featured boolean not null default false,
```

- [ ] **Step 2: Apply the migration to the live Supabase project.** Run this in the Supabase SQL editor (the service-role key cannot run DDL through PostgREST, so this is a one-time manual apply):

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

- [ ] **Step 3: Verify** in the SQL editor: `select represented_since, featured from public.artists limit 1;` → returns columns (values null/false). Public read RLS already covers `artists`; no policy change.

- [ ] **Step 4: Commit** `git add supabase/schema.sql && git commit -m "feat(db): add artist enrichment columns"`

---

### Task 2: Extend `ArtistRow`

**Files:** Modify `src/lib/supabase/types.ts`

- [ ] **Step 1:** Replace the `ArtistRow` interface with:

```ts
export interface ArtistRow {
  id: string; slug: string; name: string; birthplace: string;
  birth_year: number | null; discipline: string; bio: string;
  portrait_image_url: string | null;
  represented_since: number | null; active_since: number | null;
  based_in: string; website_url: string; instagram_url: string;
  education: string; nationality: string; cv_url: string; featured: boolean;
  created_at: string; updated_at: string;
}
```

- [ ] **Step 2:** Type-check: `npx tsc --noEmit` → no new errors (mappers will be updated in Task 4).

---

### Task 3: `Artist` type + pure helpers (TDD)

**Files:** Modify `src/lib/gallery.ts`; Create `src/lib/artistMeta.ts`, `src/lib/artistMeta.test.ts`

- [ ] **Step 1: Write the failing tests** — create `src/lib/artistMeta.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { yearsActive, normalizeUrl, instagramUrl } from './artistMeta';

describe('yearsActive', () => {
  it('derives years from a start year', () => expect(yearsActive(2011, 2026)).toBe(15));
  it('returns null when unset', () => expect(yearsActive(undefined, 2026)).toBeNull());
  it('clamps a future start to 0', () => expect(yearsActive(2030, 2026)).toBe(0));
});

describe('normalizeUrl', () => {
  it('passes through an http(s) url', () => expect(normalizeUrl('https://x.com')).toBe('https://x.com'));
  it('prefixes a bare domain', () => expect(normalizeUrl('x.com')).toBe('https://x.com'));
  it('returns null for empty', () => expect(normalizeUrl('  ')).toBeNull());
});

describe('instagramUrl', () => {
  it('builds from a handle', () => expect(instagramUrl('@artist')).toBe('https://instagram.com/artist'));
  it('passes a full url through', () => expect(instagramUrl('https://instagram.com/a')).toBe('https://instagram.com/a'));
  it('returns null for empty', () => expect(instagramUrl('')).toBeNull());
});
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/lib/artistMeta.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement** — create `src/lib/artistMeta.ts`:

```ts
// Pure helpers for artist credential display. No I/O — unit-tested.
export function yearsActive(activeSince?: number | null, currentYear = new Date().getFullYear()): number | null {
  if (!activeSince) return null;
  return Math.max(0, currentYear - activeSince);
}

export function normalizeUrl(u?: string | null): string | null {
  const s = (u ?? '').trim();
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

export function instagramUrl(v?: string | null): string | null {
  let s = (v ?? '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://instagram.com/${s.replace(/^@/, '')}`;
}
```

- [ ] **Step 4: Run, verify pass** — `npx vitest run src/lib/artistMeta.test.ts` → PASS.

- [ ] **Step 5: Extend the `Artist` interface** in `src/lib/gallery.ts` — add these optional fields inside `export interface Artist { … }` (after `bio: string;`). Optional so the in-repo generator artists (which lack them) still satisfy the type:

```ts
  representedSince?: number;
  activeSince?: number;
  basedIn?: string;
  websiteUrl?: string;
  instagramUrl?: string;
  education?: string;
  nationality?: string;
  cvUrl?: string;
  featured?: boolean;
```

- [ ] **Step 6: Commit** — `git add src/lib/artistMeta.ts src/lib/artistMeta.test.ts src/lib/gallery.ts && git commit -m "feat(artists): pure credential helpers + Artist fields"`

---

### Task 4: Map new fields in `rowToArtist` (TDD)

**Files:** Modify `src/lib/mappers.ts`; Create `src/lib/mappers.test.ts`

- [ ] **Step 1: Failing test** — create `src/lib/mappers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { rowToArtist } from './mappers';
import type { ArtistRow } from './supabase/types';

const base: ArtistRow = {
  id: 'a1', slug: 'jane-doe', name: 'Jane Doe', birthplace: 'Oslo', birth_year: 1980,
  discipline: 'Painting', bio: 'Bio.', portrait_image_url: null,
  represented_since: 2021, active_since: 2008, based_in: 'Brooklyn, NY',
  website_url: 'janedoe.com', instagram_url: '@jane', education: 'MFA, Yale, 2012',
  nationality: 'Norwegian', cv_url: 'cv/abc.pdf', featured: true,
  created_at: '', updated_at: '',
};

describe('rowToArtist enrichment', () => {
  it('maps the new fields', () => {
    const a = rowToArtist(base);
    expect(a.representedSince).toBe(2021);
    expect(a.activeSince).toBe(2008);
    expect(a.basedIn).toBe('Brooklyn, NY');
    expect(a.cvUrl).toBe('cv/abc.pdf');
    expect(a.featured).toBe(true);
    expect(a.nationality).toBe('Norwegian');
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/lib/mappers.test.ts` → FAIL (fields undefined).

- [ ] **Step 3: Implement** — in `src/lib/mappers.ts`, extend the object returned by `rowToArtist` (after `bio: r.bio,`):

```ts
    representedSince: r.represented_since ?? undefined,
    activeSince: r.active_since ?? undefined,
    basedIn: r.based_in ?? '',
    websiteUrl: r.website_url ?? '',
    instagramUrl: r.instagram_url ?? '',
    education: r.education ?? '',
    nationality: r.nationality ?? '',
    cvUrl: r.cv_url ?? '',
    featured: r.featured ?? false,
```

- [ ] **Step 4: Run, verify pass** — `npx vitest run src/lib/mappers.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git add src/lib/mappers.ts src/lib/mappers.test.ts && git commit -m "feat(artists): map enrichment fields in rowToArtist"`

---

### Task 5: Seam — featured-first order + work counts

**Files:** Modify `src/lib/gallery.ts`

- [ ] **Step 1:** In `getArtists()`, change the Supabase ordering from `.order('name', { ascending: true })` to:

```ts
      .order('featured', { ascending: false })
      .order('name', { ascending: true })
```

- [ ] **Step 2:** Add a new exported function at the end of the Artists section:

```ts
// Per-artist artwork counts for admin list + public credentials. Dual-mode.
export async function getArtistWorkCounts(): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  const tally = (rows: { artistId?: string; artist_id?: string }[]) => {
    for (const r of rows) { const id = (r as any).artistId ?? (r as any).artist_id; if (id) m.set(id, (m.get(id) ?? 0) + 1); }
  };
  if (!isSupabaseConfigured()) { tally(_artworks as any); return m; }
  try {
    const sb = createSupabaseAnon();
    const { data, error } = await sb.from('artworks').select('artist_id');
    if (error) throw error;
    tally((data ?? []) as any);
    return m;
  } catch {
    tally(_artworks as any);
    return m;
  }
}
```

- [ ] **Step 3:** Type-check + build: `npx tsc --noEmit && npm run build` → pass.

- [ ] **Step 4: Commit** — `git add src/lib/gallery.ts && git commit -m "feat(artists): featured-first order + getArtistWorkCounts"`

---

### Task 6: Upload endpoint — CV PDF kind

**Files:** Modify `src/pages/api/upload.ts`

- [ ] **Step 1:** Replace the constants and validation block. New top constants:

```ts
const ALLOWED_IMG = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMG = 5 * 1024 * 1024;
const MAX_CV = 10 * 1024 * 1024;
const PREFIXES = new Set(['artworks', 'artists', 'posts', 'cv']);
```

- [ ] **Step 2:** Replace the type/size/ext logic (the lines from `if (!ALLOWED.includes(file.type))` through the `const ext = …` line) with:

```ts
  const isCv = kind === 'cv';
  const allowed = isCv ? ['application/pdf'] : ALLOWED_IMG;
  const max = isCv ? MAX_CV : MAX_IMG;
  if (!allowed.includes(file.type)) return new Response('Bad type', { status: 415 });
  if (file.size > max) return new Response('Too large', { status: 413 });

  const ext = isCv ? 'pdf' : file.type.split('/')[1].replace('jpeg', 'jpg');
```

- [ ] **Step 3: Build** — `npm run build` → pass. (Manual verify in Task 8 via the form.)

- [ ] **Step 4: Commit** — `git add src/pages/api/upload.ts && git commit -m "feat(upload): accept CV PDF under cv kind (10MB)"`

---

### Task 7: Client upload — PDF (no image preview)

**Files:** Modify `src/scripts/admin-upload.ts`

- [ ] **Step 1:** Inside the `input.addEventListener('change', …)` handler, branch on the `cv` kind. Replace the body that sets `previewImg.src = URL.createObjectURL(file)` and the preview display with:

```ts
    const kind = input.dataset.kind ?? 'artworks';
    if (kind === 'cv') {
      preview!.style.display = 'none';
      if (msg) msg.textContent = `Uploading ${file.name}…`;
    } else {
      previewImg.src = URL.createObjectURL(file);
      preview!.style.display = 'block';
      if (msg) msg.textContent = 'Uploading…';
    }
```

- [ ] **Step 2:** In the success branch, after `if (hidden) hidden.value = url;`, set a clearer CV message:

```ts
      if (msg) msg.textContent = kind === 'cv' ? `CV uploaded ✓ (${file.name})` : 'Uploaded ✓';
```

- [ ] **Step 3: Build** — `npm run build` → pass.

- [ ] **Step 4: Commit** — `git add src/scripts/admin-upload.ts && git commit -m "feat(upload): handle CV PDF in the client uploader"`

---

### Task 8: Owner edit form

**Files:** Modify `src/pages/admin/artists/[id].astro`

- [ ] **Step 1:** In the frontmatter, after the `currentCreator` line, fetch the work count:

```ts
const { count: workCount } = await createSupabaseAdmin()
  .from('artworks').select('id', { count: 'exact', head: true }).eq('artist_id', a.id);
```

- [ ] **Step 2:** In the edit `<form>`, after the Discipline field and before Bio, add the representation + career + contact fields:

```astro
    <div class="admin-field"><label>Represented since (year)</label><input name="represented_since" type="number" value={a.represented_since ?? ''} placeholder="e.g. 2021" /></div>
    <div class="admin-field"><label>Active since (year)</label><input name="active_since" type="number" value={a.active_since ?? ''} placeholder="e.g. 2008" /></div>
    <div class="admin-field"><label>Based in</label><input name="based_in" value={a.based_in ?? ''} placeholder="e.g. Brooklyn, NY" /></div>
    <div class="admin-field"><label>Education</label><input name="education" value={a.education ?? ''} placeholder="e.g. MFA, Yale, 2012" /></div>
    <div class="admin-field"><label>Website</label><input name="website_url" value={a.website_url ?? ''} placeholder="janedoe.com" /></div>
    <div class="admin-field"><label>Instagram</label><input name="instagram_url" value={a.instagram_url ?? ''} placeholder="@janedoe" /></div>
    <div class="admin-field"><label>CV (PDF)</label>
      <input type="file" data-kind="cv" accept="application/pdf" />
      <input type="hidden" name="cv_url" value={a.cv_url ?? ''} />
      <small style="color:#7c7a77;">{a.cv_url ? 'Current CV kept unless you upload a new one.' : 'Optional — PDF up to 10MB.'}</small>
    </div>
    <div class="admin-field" style="flex-direction:row;align-items:center;gap:.6rem;">
      <input id="featured" name="featured" type="checkbox" value="1" checked={a.featured} style="width:auto;" />
      <label for="featured" style="margin:0;">Featured artist</label>
    </div>
    <p class="admin-status">Works on site: <strong>{workCount ?? 0}</strong></p>
```

- [ ] **Step 3: Build** — `npm run build` → pass.

- [ ] **Step 4: Manual verify** (after Task 9): owner edit page shows all new fields, no nationality input, the works count, and a featured checkbox.

- [ ] **Step 5: Commit** — `git add src/pages/admin/artists/[id].astro && git commit -m "feat(admin): artist enrichment fields on the edit form"`

---

### Task 9: Owner persist

**Files:** Modify `src/pages/admin/artists/save.ts`

- [ ] **Step 1:** Extend the `fields` object (after `portrait_image_url: …,`):

```ts
    represented_since: f.get('represented_since') ? Number(f.get('represented_since')) : null,
    active_since: f.get('active_since') ? Number(f.get('active_since')) : null,
    based_in: String(f.get('based_in') ?? ''),
    website_url: String(f.get('website_url') ?? ''),
    instagram_url: String(f.get('instagram_url') ?? ''),
    education: String(f.get('education') ?? ''),
    cv_url: String(f.get('cv_url') ?? ''),
    featured: f.get('featured') === '1',
```

(Note: `nationality` is intentionally NOT set here — owner never edits it.)

- [ ] **Step 2: Build** — `npm run build` → pass.

- [ ] **Step 3: Manual verify:** edit an artist as owner → set represented-since + featured + upload a CV → save → reload → values persisted; mark featured → it sorts first in the list.

- [ ] **Step 4: Commit** — `git add src/pages/admin/artists/save.ts && git commit -m "feat(admin): persist artist enrichment fields"`

---

### Task 10: Creator Studio profile form

**Files:** Modify `src/pages/studio/profile/index.astro`

- [ ] **Step 1:** Confirm `getOwnedArtist` returns the raw row (selects `*`); the new columns are then on `a`. (If it projects specific columns, widen the select to `*`.)

- [ ] **Step 2:** In the frontmatter, fetch work count + read-only context:

```ts
import { createSupabaseAdmin } from '../../../lib/supabase/server';
const { count: workCount } = await createSupabaseAdmin()
  .from('artworks').select('id', { count: 'exact', head: true }).eq('artist_id', a.id);
```

- [ ] **Step 3:** In the `<form>`, after Discipline and before Bio, add the self-description fields (incl. nationality, NOT represented_since/featured):

```astro
    <div class="admin-field"><label>Active since (year)</label><input name="active_since" type="number" value={a.active_since ?? ''} placeholder="e.g. 2008" /></div>
    <div class="admin-field"><label>Based in</label><input name="based_in" value={a.based_in ?? ''} placeholder="e.g. Brooklyn, NY" /></div>
    <div class="admin-field"><label>Nationality</label><input name="nationality" value={a.nationality ?? ''} placeholder="optional" /></div>
    <div class="admin-field"><label>Education</label><input name="education" value={a.education ?? ''} placeholder="e.g. MFA, Yale, 2012" /></div>
    <div class="admin-field"><label>Website</label><input name="website_url" value={a.website_url ?? ''} placeholder="janedoe.com" /></div>
    <div class="admin-field"><label>Instagram</label><input name="instagram_url" value={a.instagram_url ?? ''} placeholder="@janedoe" /></div>
    <div class="admin-field"><label>CV (PDF)</label>
      <input type="file" data-kind="cv" accept="application/pdf" />
      <input type="hidden" name="cv_url" value={a.cv_url ?? ''} />
      <small style="color:#7c7a77;">{a.cv_url ? 'Current CV kept unless you upload a new one.' : 'Optional — PDF up to 10MB.'}</small>
    </div>
```

- [ ] **Step 4:** Below the form (context the artist can see but not edit):

```astro
  <p class="admin-status" style="margin-top:1rem;">Works on site: <strong>{workCount ?? 0}</strong>{a.represented_since ? ` · Represented since ${a.represented_since}` : ''}{a.featured ? ' · ★ Featured' : ''}</p>
```

- [ ] **Step 5: Build** — `npm run build` → pass.

- [ ] **Step 6: Commit** — `git add src/pages/studio/profile/index.astro && git commit -m "feat(studio): self-description fields on the creator profile"`

---

### Task 11: Creator persist

**Files:** Modify `src/pages/studio/profile/save.ts`

- [ ] **Step 1:** Extend the `fields` object (after `portrait_image_url: …,`) — note represented_since/featured are absent (creator can't set them):

```ts
    active_since: f.get('active_since') ? Number(f.get('active_since')) : null,
    based_in: String(f.get('based_in') ?? ''),
    nationality: String(f.get('nationality') ?? ''),
    education: String(f.get('education') ?? ''),
    website_url: String(f.get('website_url') ?? ''),
    instagram_url: String(f.get('instagram_url') ?? ''),
    cv_url: String(f.get('cv_url') ?? ''),
```

- [ ] **Step 2: Build** — `npm run build` → pass.

- [ ] **Step 3: Manual verify:** log in as the creator → edit nationality + active-since + CV → save → persisted, scoped to own artist; represented_since/featured unchanged.

- [ ] **Step 4: Commit** — `git add src/pages/studio/profile/save.ts && git commit -m "feat(studio): persist creator self-description fields"`

---

### Task 12: Public artist page — credentials block

**Files:** Modify `src/pages/artists/[slug].astro`

- [ ] **Step 1:** Add imports + derived values in the frontmatter:

```ts
import { yearsActive, normalizeUrl, instagramUrl } from '../../lib/artistMeta';
const ya = yearsActive(artist.activeSince);
const web = normalizeUrl(artist.websiteUrl);
const ig = instagramUrl(artist.instagramUrl);
```

- [ ] **Step 2:** In the right column of `.artist-hero`, after the `<div class="prose" set:html={artist.bio} />` line, insert the credentials block:

```astro
        <dl class="artist-creds">
          {artist.featured && <div class="cred-featured"><dt>Status</dt><dd>★ Featured artist</dd></div>}
          {artist.representedSince && <div><dt>Represented since</dt><dd>{artist.representedSince}</dd></div>}
          {ya !== null && <div><dt>Years active</dt><dd>{ya}</dd></div>}
          {artist.basedIn && <div><dt>Based in</dt><dd>{artist.basedIn}</dd></div>}
          <div><dt>Works on view</dt><dd>{works.length}</dd></div>
          {artist.education && <div><dt>Education</dt><dd>{artist.education}</dd></div>}
          {artist.nationality && <div><dt>Nationality</dt><dd>{artist.nationality}</dd></div>}
        </dl>
        <div class="artist-links">
          {web && <a href={web} rel="noopener" target="_blank">Website ↗</a>}
          {ig && <a href={ig} rel="noopener" target="_blank">Instagram ↗</a>}
          {artist.cvUrl && <a href={artist.cvUrl} rel="noopener" target="_blank">Download CV (PDF) ↗</a>}
        </div>
```

- [ ] **Step 3: Build** — `npm run build` → pass. Manual verify: a populated artist shows the block (only-set rows), links open, CV downloads; an empty artist shows just "Works on view".

- [ ] **Step 4: Commit** — `git add src/pages/artists/[slug].astro && git commit -m "feat(artists): public credentials block + links + CV"`

---

### Task 13: Owner artists list — counts + featured

**Files:** Modify `src/pages/admin/artists/index.astro`

- [ ] **Step 1:** Widen the select + order, and fetch counts. Replace the artists query block:

```ts
import { artSVG, getArtistWorkCounts } from '../../../lib/gallery';
const { data: artists } = await createSupabaseAdmin()
  .from('artists')
  .select('id, name, discipline, portrait_image_url, featured, represented_since')
  .order('featured', { ascending: false })
  .order('name');
const counts = await getArtistWorkCounts();
```

- [ ] **Step 2:** In the tile `.tartist` line, replace the discipline-only line with discipline + count + featured + represented:

```astro
          <div class="tartist">
            {a.featured && <span style="color:var(--mw-accent);">★ </span>}
            {a.discipline}{a.discipline ? ' · ' : ''}{counts.get(a.id) ?? 0} works{a.represented_since ? ` · since ${a.represented_since}` : ''}
          </div>
```

- [ ] **Step 3: Build** — `npm run build` → pass. Manual verify: list shows "N works", featured artists first with a ★.

- [ ] **Step 4: Commit** — `git add src/pages/admin/artists/index.astro && git commit -m "feat(admin): artist list shows work counts + featured"`

---

### Task 14: Public artists index — featured badge

**Files:** Modify `src/pages/artists/index.astro`

(Ordering already comes from `getArtists()` — Task 5. Only the badge is added.)

- [ ] **Step 1:** In the `.aii` anchor, inside `.aii-img`, add the badge after the `<img …>`:

```astro
              {c.artist.featured && <span class="aii-badge">Featured</span>}
```

- [ ] **Step 2:** Make `.aii-img` a positioning context and style the badge — in the `<style>` block, add `position: relative;` to `.aii-img` and append:

```css
  .aii-badge {
    position: absolute; top: 0.7rem; left: 0.7rem;
    font-size: 0.6rem; letter-spacing: 0.14em; text-transform: uppercase;
    padding: 0.3rem 0.6rem; background: var(--paper); color: var(--accent-2);
    border: 1px solid var(--line);
  }
```

- [ ] **Step 3: Build** — `npm run build` → pass.

- [ ] **Step 4: Commit** — `git add src/pages/artists/index.astro && git commit -m "feat(artists): featured badge on the public list"`

---

### Task 15: Public credentials styles

**Files:** Modify `src/styles/styles.css`

- [ ] **Step 1:** Append to `src/styles/styles.css`:

```css
/* Artist credentials block */
.artist-creds { margin: 1.6rem 0 0; padding: 1.3rem 0 0; border-top: 1px solid var(--line); display: grid; gap: 0.7rem; }
.artist-creds > div { display: flex; justify-content: space-between; gap: 1.5rem; align-items: baseline; }
.artist-creds dt { font-size: 0.7rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-soft); margin: 0; }
.artist-creds dd { margin: 0; font-size: 0.95rem; color: var(--ink); text-align: right; }
.artist-creds .cred-featured dd { color: var(--accent-2); }
.artist-links { display: flex; flex-wrap: wrap; gap: 1.4rem; margin-top: 1.3rem; }
.artist-links a { font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink); border-bottom: 1px solid var(--line); padding-bottom: 2px; }
.artist-links a:hover { border-color: var(--accent-2); color: var(--accent-2); }
```

- [ ] **Step 2: Build** — `npm run build` → pass.

- [ ] **Step 3: Commit** — `git add src/styles/styles.css && git commit -m "feat(artists): credentials block + links styles"`

---

### Task 16: Full verification + deploy

- [ ] **Step 1:** Unit tests — `npx vitest run` → all pass.
- [ ] **Step 2:** Build — `npm run build` → Complete.
- [ ] **Step 3:** Authenticated screenshot pass (mint an owner session): owner edit form (new fields, no nationality, featured, CV, count), creator profile (nationality present, no represented/featured edit), public artist page (credentials block + links + CV + featured badge), admin list (counts + featured-first), public artists index (featured badge + order).
- [ ] **Step 4:** Deploy — `git push origin HEAD && git push origin HEAD:main`; verify production artist page shows the credentials block.

---

## Self-review

- **Spec coverage:** every field (represented_since/active_since/based_in/website_url/instagram_url/education/nationality/cv_url/featured) + derived count is created (T1–2), mapped (T4), edited (owner T8/9, creator T10/11), and displayed (public T12/14, admin T13). CV upload (T6/7), featured order (T5/13/14). ✓
- **Permission split:** nationality only in creator form (T10), never owner (T8/9 note); represented_since/featured only owner (absent from creator T10/11). ✓
- **Placeholders:** none — every step carries real code.
- **Type consistency:** `ArtistRow` (T2) ↔ `rowToArtist` (T4) ↔ `Artist` optional fields (T3) ↔ form `name=` keys ↔ `save.ts` `f.get()` keys all aligned (snake_case form names → snake_case DB columns; camelCase only on the `Artist` view type).
- **Migration risk:** Task 1 must run on the live DB before the forms post new columns; flagged as a manual SQL-editor step.
