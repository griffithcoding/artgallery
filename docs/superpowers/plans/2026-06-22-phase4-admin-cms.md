# Phase 4 — Owner-Ready Admin CMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the gallery CMS so a non-technical older gallery owner can run the whole site alone — reach every module from the menu, add artists/artworks/images without dead-ends, edit contact/hours, see a real dashboard, search, and manage media.

**Architecture:** Astro 5 (`output: server`) + Supabase. I/O stays in `.astro` pages / `*.ts` endpoints using the service-role client (`createSupabaseAdmin()`); all logic goes in pure, unit-tested lib modules (vitest). New DB reads fall back to safe defaults (dual-mode), matching `src/lib/gallery.ts`.

**Tech Stack:** Astro, TypeScript, `@supabase/supabase-js`, `sanitize-html`, vitest. Reuse `src/styles/admin.css`. Spec: `docs/superpowers/specs/2026-06-22-phase4-admin-cms-design.md`. Audit: `docs/audits/2026-06-22-admin-portal-audit.md`.

---

## File structure

**Create**
- `src/lib/adminResult.ts` (+ `src/lib/adminResult.test.ts`) — redirect-URL builders for save/delete flows.
- `src/lib/dashboard.ts` (+ test) — `buildChecklist`, `checklistComplete`.
- `src/lib/search.ts` (+ test) — `searchAdmin`.
- `src/lib/media.ts` (+ test) — `collectReferencedUrls`, `classifyObjects`.
- `src/lib/settings.ts` (+ test) — `getDefaults`, `mergeSettings`, `getSettings`.
- `src/pages/admin/search.astro` — search results page.
- `src/pages/admin/media/index.astro`, `src/pages/admin/media/action.ts` — media library + delete.
- `src/pages/admin/settings/index.astro`, `src/pages/admin/settings/save.ts` — contact/hours form.

**Modify**
- `src/layouts/AdminLayout.astro` — nav links + search omnibox.
- `src/styles/admin.css` — omnibox, stat cards, checklist, search-group, settings styles.
- `src/pages/admin/index.astro` — full dashboard rewrite.
- All write handlers (error handling): `src/pages/admin/{artists,artworks,exhibitions,fairs,inquiries}/{save.ts,action.ts}`, `src/pages/admin/homepage/hero.ts`, `src/pages/admin/pages/save.ts`.
- Index pages (render error banner): `src/pages/admin/{artists,artworks,exhibitions,fairs}/index.astro`.
- `src/pages/api/upload.ts` — descriptive errors + `library` prefix.
- `src/scripts/admin-upload.ts` — surface errors, lock submit while uploading.
- File inputs (`accept`): `src/pages/admin/{artworks,artists,exhibitions}/{new,[id]}.astro`.
- `supabase/schema.sql` — `site_settings` table.
- `src/components/Footer.astro`, `src/pages/contact.astro`, `src/pages/visit.astro` — read `getSettings()`.
- `src/pages/admin/artists/save.ts` — sanitize bio (Group F).
- `src/pages/works/index.astro` — escape JSON island (Group F).

---

# GROUP A — Owner-readiness blockers

## Task 1: `adminResult` redirect helpers

**Files:**
- Create: `src/lib/adminResult.ts`
- Test: `src/lib/adminResult.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/adminResult.test.ts
import { describe, it, expect } from 'vitest';
import { okRedirect, errRedirect } from './adminResult';

describe('adminResult', () => {
  it('okRedirect defaults to ?saved=1', () => {
    expect(okRedirect('/admin/artists')).toBe('/admin/artists?saved=1');
  });
  it('okRedirect supports deleted/updated flags', () => {
    expect(okRedirect('/admin/fairs', 'deleted')).toBe('/admin/fairs?deleted=1');
    expect(okRedirect('/admin/inquiries', 'updated')).toBe('/admin/inquiries?updated=1');
  });
  it('errRedirect URL-encodes the message', () => {
    expect(errRedirect('/admin/artists', 'Save failed: bad UUID & null'))
      .toBe('/admin/artists?error=Save%20failed%3A%20bad%20UUID%20%26%20null');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/adminResult.test.ts`
Expected: FAIL — cannot find module `./adminResult`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/adminResult.ts
// Builds the redirect targets used by admin save/delete handlers so success and
// failure are both visible to the user (no more silent false "Saved").
export type OkFlag = 'saved' | 'deleted' | 'updated';

export function okRedirect(base: string, flag: OkFlag = 'saved'): string {
  return `${base}?${flag}=1`;
}

export function errRedirect(base: string, message: string): string {
  return `${base}?error=${encodeURIComponent(message)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/adminResult.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/adminResult.ts src/lib/adminResult.test.ts
git commit -m "feat(admin): add adminResult redirect helpers (TDD)"
```

---

## Task 2: Surface DB errors in every write handler

Today every handler ignores the Supabase `{ error }` and always redirects to `?saved=1`/`?deleted=1`, so a failed write reports success (audit F1). Apply this **transformation rule** to each handler:

1. Import the helpers: `import { okRedirect, errRedirect } from '<relative>/lib/adminResult';`
2. Capture `{ error }` from each write call. For inserts that first read slugs, only the **insert/update/delete** error matters.
3. On error: `return redirect(errRedirect('<base>', error.message), 303);`
4. On success: `return redirect(okRedirect('<base>'[, 'deleted']), 303);`

**Files & exact targets:**

| File | Write call(s) to capture `{ error }` | Base / success flag |
|---|---|---|
| `admin/artists/save.ts` | `.update(fields).eq('id', id)` and `.insert({ ...fields, slug })` | `/admin/artists` / saved |
| `admin/artists/action.ts` | `.delete().eq('id', id)` | `/admin/artists` / deleted |
| `admin/artworks/save.ts` | update + insert | `/admin/artworks` / saved |
| `admin/artworks/action.ts` | delete | `/admin/artworks` / deleted |
| `admin/exhibitions/save.ts` | update/insert + `exhibition_artists` insert | `/admin/exhibitions` / saved |
| `admin/exhibitions/action.ts` | delete | `/admin/exhibitions` / deleted |
| `admin/fairs/save.ts` | update + insert | `/admin/fairs` / saved |
| `admin/fairs/action.ts` | delete | `/admin/fairs` / deleted |
| `admin/inquiries/save.ts` | update | `/admin/inquiries` / updated |
| `admin/inquiries/action.ts` | bulk update | `/admin/inquiries` / updated |
| `admin/homepage/hero.ts` | storage upload | `/admin/homepage` / saved |
| `admin/pages/save.ts` | pages upsert | `/admin/pages` / saved |

**Files:**
- Modify: each file in the table above.

- [ ] **Step 1: Worked example — `src/pages/admin/artists/save.ts`**

Replace the `if (id) { ... } else { ... } return redirect(...)` block (lines 35-42) with:

```ts
  if (id) {
    const { error } = await admin.from('artists').update(fields).eq('id', id);
    if (error) return redirect(errRedirect('/admin/artists', error.message), 303);
  } else {
    const { data: existing } = await admin.from('artists').select('slug');
    const slug = uniqueSlug(slugify(name), (existing ?? []).map((r) => r.slug));
    const { error } = await admin.from('artists').insert({ ...fields, slug });
    if (error) return redirect(errRedirect('/admin/artists', error.message), 303);
  }
  return redirect(okRedirect('/admin/artists'), 303);
```

And add at the top with the other imports:

```ts
import { okRedirect, errRedirect } from '../../../lib/adminResult';
```

- [ ] **Step 2: Worked example — `src/pages/admin/fairs/action.ts`**

Replace line 12-13 (`if (id) await ...; return redirect(...)`) with:

```ts
  if (id) {
    const { error } = await createSupabaseAdmin().from('fairs').delete().eq('id', id);
    if (error) return redirect(errRedirect('/admin/fairs', error.message), 303);
  }
  return redirect(okRedirect('/admin/fairs', 'deleted'), 303);
```

Add import:

```ts
import { okRedirect, errRedirect } from '../../../lib/adminResult';
```

- [ ] **Step 3: Apply the same rule to the remaining 10 handlers** in the table, using each file's base/flag. Each `*/save.ts` uses `okRedirect(base)`; each `*/action.ts` uses `okRedirect(base, 'deleted')` (inquiries/action → `'updated'`). `import` path is `../../../lib/adminResult` for all (they sit at `admin/<module>/`).

- [ ] **Step 4: Render the error banner on the four list pages** that don't yet show one. In `admin/{artists,artworks,exhibitions,fairs}/index.astro`, after the existing `const saved = ...`/`const deleted = ...` lines add:

```astro
const error = Astro.url.searchParams.get('error');
```

and in the markup, beside the existing `{saved && ...}` line add:

```astro
{error && <p class="admin-status err">{error}</p>}
```

(`fairs/index.astro` already reads `saved`/`deleted` at lines 11-12 and renders them at 22-23 — insert the `error` const and banner there.)

- [ ] **Step 5: Typecheck + build**

Run: `npm run build`
Expected: BUILD OK (no TS errors).

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin
git commit -m "fix(admin): surface DB write errors instead of false success (F1)"
```

---

## Task 3: Harden image upload (errors + submit lock)

**Files:**
- Modify: `src/pages/api/upload.ts:26-27`
- Modify: `src/scripts/admin-upload.ts`

- [ ] **Step 1: Descriptive server errors.** In `src/pages/api/upload.ts`, replace the two validation responses (lines 26-27):

```ts
  if (!allowed.includes(file.type))
    return new Response(isCv ? 'Please upload a PDF.' : 'Please use a JPG, PNG, or WebP image.', { status: 415 });
  if (file.size > max)
    return new Response(isCv ? 'PDF must be under 10 MB.' : 'Image must be under 5 MB.', { status: 413 });
```

- [ ] **Step 2: Surface the message + lock submit while uploading.** Replace the body of the `change` listener in `src/scripts/admin-upload.ts` (lines 27-51) with:

```ts
  const form = input.closest('form');
  const submitBtn = form?.querySelector<HTMLButtonElement>('button[type=submit], button:not([type])') ?? null;

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    const kind = input.dataset.kind ?? 'artworks';
    if (kind === 'cv') {
      preview!.style.display = 'none';
      if (msg) msg.textContent = `Uploading ${file.name}…`;
    } else {
      previewImg.src = URL.createObjectURL(file);
      preview!.style.display = 'block';
      if (msg) msg.textContent = 'Uploading…';
    }
    if (submitBtn) submitBtn.disabled = true;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', kind);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        const reason = (await res.text()) || 'Upload failed.';
        if (msg) { msg.textContent = reason; msg.style.color = '#8a2b1f'; }
        return;
      }
      const { url } = await res.json();
      if (hidden) hidden.value = url;
      if (msg) { msg.textContent = kind === 'cv' ? `CV uploaded ✓ (${file.name})` : 'Uploaded ✓'; msg.style.color = ''; }
    } catch {
      if (msg) { msg.textContent = 'Upload failed — check your connection.'; msg.style.color = '#8a2b1f'; }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
```

- [ ] **Step 3: Block submit if a file was chosen but not yet uploaded.** Still in `admin-upload.ts`, after the `change` listener (inside the same `forEach`), add:

```ts
  form?.addEventListener('submit', (e) => {
    if (input.files?.[0] && hidden && !hidden.value) {
      e.preventDefault();
      if (msg) { msg.textContent = 'Please wait for the image to finish uploading.'; msg.style.color = '#8a2b1f'; }
    }
  });
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: BUILD OK.

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/upload.ts src/scripts/admin-upload.ts
git commit -m "fix(admin): clear upload errors + lock submit until upload completes (U5)"
```

---

## Task 4: Restrict file inputs to supported formats

**Files:**
- Modify: `src/pages/admin/artworks/new.astro:33`, `src/pages/admin/artworks/[id].astro:37`
- Modify: `src/pages/admin/artists/new.astro:14`, `src/pages/admin/artists/[id].astro:39`
- Modify: `src/pages/admin/exhibitions/new.astro:28`, `src/pages/admin/exhibitions/[id].astro:38`

- [ ] **Step 1: Replace `accept="image/*"` with the supported set** on each of the six image file inputs (NOT the artist CV input, which is `accept="application/pdf"`):

```astro
accept="image/jpeg,image/png,image/webp"
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: BUILD OK.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/artworks src/pages/admin/artists src/pages/admin/exhibitions
git commit -m "fix(admin): only offer JPG/PNG/WebP in image pickers (U5)"
```

---

## Task 5: Admin nav links + search omnibox

**Files:**
- Modify: `src/layouts/AdminLayout.astro:6-13` (links) and `:24-30` (nav markup)
- Modify: `src/styles/admin.css` (append omnibox styles)

- [ ] **Step 1: Replace the `links` array** (lines 6-13) with the full module set:

```ts
const links = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/artworks', label: 'Artworks' },
  { href: '/admin/artists', label: 'Artists' },
  { href: '/admin/exhibitions', label: 'Exhibitions' },
  { href: '/admin/fairs', label: 'Art Fairs' },
  { href: '/admin/pages', label: 'Pages' },
  { href: '/admin/homepage', label: 'Homepage' },
  { href: '/admin/media', label: 'Media' },
  { href: '/admin/inquiries', label: 'Inquiries' },
  { href: '/admin/settings', label: 'Settings' },
];
const q = Astro.url.searchParams.get('q') ?? '';
```

- [ ] **Step 2: Add the omnibox + keep Sign out.** Replace the nav block (lines 24-30) with:

```astro
  <nav class="admin-nav">
    <span class="admin-brand">Mazlish + Wright</span>
    {links.map((l) => (
      <a href={l.href} aria-current={path === l.href ? 'page' : undefined}>{l.label}</a>
    ))}
    <form class="admin-search" method="GET" action="/admin/search" role="search">
      <input type="search" name="q" value={q} placeholder="Search…" aria-label="Search the portal" />
    </form>
    <a href="/admin/logout">Sign out</a>
  </nav>
```

- [ ] **Step 3: Append omnibox styles** to `src/styles/admin.css`:

```css
/* ── Admin search omnibox ─────────────────────────────────────────── */
.admin-search { margin-left: auto; }
.admin-search input {
  background: var(--mw-white); border: 1px solid var(--mw-line); color: var(--mw-ink);
  padding: .5rem .85rem; font-family: var(--mw-sans); font-size: .85rem; border-radius: 999px; width: 16ch;
  transition: width .25s var(--mw-ease), border-color .2s var(--mw-ease);
}
.admin-search input:focus { outline: none; border-color: var(--mw-accent); width: 22ch; }
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: BUILD OK. (`/admin/media`, `/admin/search`, `/admin/settings` links will 404 until their tasks land — that's expected mid-plan.)

- [ ] **Step 5: Commit**

```bash
git add src/layouts/AdminLayout.astro src/styles/admin.css
git commit -m "feat(admin): full nav (Artworks, Pages, Media, Settings) + search omnibox (U1)"
```

---

# GROUP B — Dashboard + onboarding checklist

## Task 6: `dashboard` checklist logic

**Files:**
- Create: `src/lib/dashboard.ts`
- Test: `src/lib/dashboard.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/dashboard.test.ts
import { describe, it, expect } from 'vitest';
import { buildChecklist, checklistComplete } from './dashboard';

const base = { artists: 0, artworks: 0, exhibitions: 0, fairs: 0, homepageHero: false };

describe('buildChecklist', () => {
  it('returns five steps, all not-done for an empty gallery', () => {
    const items = buildChecklist(base);
    expect(items).toHaveLength(5);
    expect(items.every((i) => !i.done)).toBe(true);
    expect(items[0].href).toBe('/admin/artists/new');
  });
  it('marks a step done when its count is positive', () => {
    const items = buildChecklist({ ...base, artworks: 3, homepageHero: true });
    expect(items.find((i) => i.key === 'artwork')!.done).toBe(true);
    expect(items.find((i) => i.key === 'homepage')!.done).toBe(true);
    expect(items.find((i) => i.key === 'artist')!.done).toBe(false);
  });
  it('checklistComplete is true only when every step is done', () => {
    expect(checklistComplete(buildChecklist(base))).toBe(false);
    expect(checklistComplete(buildChecklist({ artists: 1, artworks: 1, exhibitions: 1, fairs: 1, homepageHero: true }))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/dashboard.test.ts`
Expected: FAIL — cannot find module `./dashboard`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/dashboard.ts
// Derives the dynamic onboarding checklist from data presence. Pure — the page
// supplies the counts.
export interface DashboardCounts {
  artists: number; artworks: number; exhibitions: number; fairs: number; homepageHero: boolean;
}
export interface ChecklistItem { key: string; label: string; href: string; done: boolean; }

export function buildChecklist(c: DashboardCounts): ChecklistItem[] {
  return [
    { key: 'artist', label: 'Add your first artist', href: '/admin/artists/new', done: c.artists > 0 },
    { key: 'artwork', label: 'Add your first artwork', href: '/admin/artworks/new', done: c.artworks > 0 },
    { key: 'exhibition', label: 'Create an exhibition', href: '/admin/exhibitions/new', done: c.exhibitions > 0 },
    { key: 'fair', label: 'Add an art fair', href: '/admin/fairs/new', done: c.fairs > 0 },
    { key: 'homepage', label: 'Set the homepage photo', href: '/admin/homepage', done: c.homepageHero },
  ];
}

export function checklistComplete(items: ChecklistItem[]): boolean {
  return items.every((i) => i.done);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/dashboard.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboard.ts src/lib/dashboard.test.ts
git commit -m "feat(admin): dashboard checklist logic (TDD)"
```

---

## Task 7: Dashboard page rewrite

**Files:**
- Modify (full rewrite): `src/pages/admin/index.astro`
- Modify: `src/styles/admin.css` (append dashboard styles)

- [ ] **Step 1: Replace `src/pages/admin/index.astro` entirely** with:

```astro
---
export const prerender = false;
import AdminLayout from '../../layouts/AdminLayout.astro';
import { createSupabaseAdmin } from '../../lib/supabase/server';
import { buildChecklist, checklistComplete } from '../../lib/dashboard';
import { rowToInquiry } from '../../lib/inquiries';

const user = Astro.locals.user!;
const admin = createSupabaseAdmin();

async function countOf(table: string): Promise<number> {
  try {
    const { count } = await admin.from(table).select('*', { count: 'exact', head: true });
    return count ?? 0;
  } catch { return 0; }
}

const [artworks, artists, exhibitions, fairs] = await Promise.all([
  countOf('artworks'), countOf('artists'), countOf('exhibitions'), countOf('fairs'),
]);

// recent inquiries + new count
let recent: ReturnType<typeof rowToInquiry>[] = [];
let newInquiries = 0;
try {
  const { data } = await admin.from('inquiries').select('*').order('created_at', { ascending: false }).limit(5);
  recent = (data ?? []).map(rowToInquiry);
  const { count } = await admin.from('inquiries').select('*', { count: 'exact', head: true }).eq('status', 'new');
  newInquiries = count ?? 0;
} catch { /* none */ }

// homepage hero present?
let homepageHero = false;
try {
  const { data } = await admin.storage.from('gallery-images').list('site', { search: 'hero' });
  homepageHero = (data ?? []).length > 0;
} catch { /* none */ }

const checklist = buildChecklist({ artists, artworks, exhibitions, fairs, homepageHero });
const done = checklistComplete(checklist);

const cards = [
  { label: 'Artworks', value: artworks, href: '/admin/artworks' },
  { label: 'Artists', value: artists, href: '/admin/artists' },
  { label: 'Exhibitions', value: exhibitions, href: '/admin/exhibitions' },
  { label: 'Art Fairs', value: fairs, href: '/admin/fairs' },
  { label: 'New inquiries', value: newInquiries, href: '/admin/inquiries' },
];
---
<AdminLayout title="Dashboard">
  <div class="admin-toolbar">
    <div>
      <p class="admin-eyebrow">Welcome</p>
      <h1>Dashboard</h1>
      <span class="admin-count">Signed in as {user.email}</span>
    </div>
    <a class="admin-btn" href="/admin/artworks/new">+ New artwork</a>
  </div>

  <div class="stat-row">
    {cards.map((c) => (
      <a class="stat-card" href={c.href}>
        <span class="stat-value">{c.value}</span>
        <span class="stat-label">{c.label}</span>
      </a>
    ))}
  </div>

  {!done && (
    <section class="dash-section">
      <h2 class="dash-h2">Get set up</h2>
      <ul class="checklist">
        {checklist.map((i) => (
          <li class={i.done ? 'is-done' : ''}>
            <span class="check">{i.done ? '✓' : ''}</span>
            {i.done ? <span>{i.label}</span> : <a href={i.href}>{i.label} →</a>}
          </li>
        ))}
      </ul>
    </section>
  )}
  {done && <p class="admin-status" style="color:#3f6b4f;">Setup complete ✓</p>}

  <section class="dash-section">
    <h2 class="dash-h2">Recent inquiries</h2>
    {recent.length === 0 ? (
      <p class="admin-empty">No inquiries yet — your public Inquire form feeds the inbox.</p>
    ) : (
      <table class="admin-table">
        <thead><tr><th>Date</th><th>Name</th><th>Status</th></tr></thead>
        <tbody>
          {recent.map((i) => (
            <tr>
              <td style="white-space:nowrap;">{new Date(i.createdAt).toLocaleDateString()}</td>
              <td><a href={`/admin/inquiries/${i.id}`}>{i.name}</a></td>
              <td><span class={`badge badge--${i.status}`}>{i.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </section>

  <section class="dash-section">
    <h2 class="dash-h2">Quick actions</h2>
    <div class="quick-actions">
      <a class="admin-btn ghost" href="/admin/artworks/new">+ New artwork</a>
      <a class="admin-btn ghost" href="/admin/artists/new">+ New artist</a>
      <a class="admin-btn ghost" href="/admin/exhibitions/new">+ New exhibition</a>
      <a class="admin-btn ghost" href="/admin/fairs/new">+ New fair</a>
    </div>
  </section>
</AdminLayout>
```

- [ ] **Step 2: Append dashboard styles** to `src/styles/admin.css`:

```css
/* ── Dashboard ────────────────────────────────────────────────────── */
.stat-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2.4rem; }
.stat-card { display: flex; flex-direction: column; gap: .3rem; padding: 1.3rem 1.4rem; background: var(--mw-panel); border: 1px solid var(--mw-line); border-radius: 12px; text-decoration: none; transition: border-color .2s var(--mw-ease); }
.stat-card:hover { border-color: var(--mw-accent); }
.stat-value { font-family: var(--mw-serif); font-size: 2rem; color: var(--mw-ink); line-height: 1; }
.stat-label { font-size: .7rem; letter-spacing: .14em; text-transform: uppercase; color: var(--mw-ink-soft); }
.dash-section { margin-bottom: 2.4rem; }
.dash-h2 { font-family: var(--mw-serif); font-weight: 400; font-size: 1.3rem; margin: 0 0 1rem; }
.checklist { list-style: none; margin: 0; padding: 0; display: grid; gap: .5rem; max-width: 540px; }
.checklist li { display: flex; align-items: center; gap: .7rem; padding: .7rem 1rem; background: var(--mw-panel); border: 1px solid var(--mw-line); border-radius: 8px; }
.checklist li.is-done { color: var(--mw-ink-soft); }
.checklist .check { width: 1.4rem; height: 1.4rem; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--mw-line); border-radius: 999px; color: #3f6b4f; font-size: .8rem; }
.checklist li.is-done .check { background: #eef3ec; border-color: #cfe0c7; }
.checklist a { color: var(--mw-ink); text-decoration: none; }
.checklist a:hover { color: var(--mw-accent); }
.quick-actions { display: flex; gap: .7rem; flex-wrap: wrap; }
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: BUILD OK.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/index.astro src/styles/admin.css
git commit -m "feat(admin): real dashboard — stats, onboarding checklist, recent inquiries (U4)"
```

---

# GROUP C — Global search

## Task 8: `searchAdmin` logic

**Files:**
- Create: `src/lib/search.ts`
- Test: `src/lib/search.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/search.test.ts
import { describe, it, expect } from 'vitest';
import { searchAdmin, type SearchDatasets } from './search';

const data: SearchDatasets = {
  artworks: [{ id: 'w1', title: 'Blue Nude', medium: 'Oil', year: 2021, artistName: 'Ada Reef' }],
  artists: [{ id: 'a1', name: 'Ada Reef', discipline: 'Painting' }],
  exhibitions: [{ id: 'e1', title: 'Summer Group', subtitle: 'New works' }],
  fairs: [{ id: 'f1', name: 'Frieze', city: 'London' }],
  inquiries: [{ id: 'i1', name: 'John Buyer', email: 'john@x.com', message: 'Is Blue Nude available?' }],
};

describe('searchAdmin', () => {
  it('returns no groups for a blank query', () => {
    expect(searchAdmin('   ', data)).toEqual([]);
  });
  it('matches across entities case-insensitively', () => {
    const groups = searchAdmin('blue', data);
    const kinds = groups.map((g) => g.kind);
    expect(kinds).toContain('artwork');   // title
    expect(kinds).toContain('inquiry');   // message mentions Blue Nude
    const artwork = groups.find((g) => g.kind === 'artwork')!;
    expect(artwork.hits[0].href).toBe('/admin/artworks/w1');
  });
  it('matches an artwork by its artist name', () => {
    const groups = searchAdmin('ada', data);
    expect(groups.find((g) => g.kind === 'artwork')).toBeTruthy();
    expect(groups.find((g) => g.kind === 'artist')).toBeTruthy();
  });
  it('omits groups with no hits', () => {
    const groups = searchAdmin('frieze', data);
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('fair');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/search.test.ts`
Expected: FAIL — cannot find module `./search`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/search.ts
// Pure cross-module admin search. The page fetches the datasets; this filters.
export type SearchKind = 'artwork' | 'artist' | 'exhibition' | 'fair' | 'inquiry';
export interface SearchHit { kind: SearchKind; title: string; subtitle: string; href: string; }
export interface SearchGroup { kind: SearchKind; label: string; hits: SearchHit[]; }

export interface SearchDatasets {
  artworks: Array<{ id: string; title: string; medium: string; year: number; artistName: string }>;
  artists: Array<{ id: string; name: string; discipline: string }>;
  exhibitions: Array<{ id: string; title: string; subtitle: string }>;
  fairs: Array<{ id: string; name: string; city: string }>;
  inquiries: Array<{ id: string; name: string; email: string; message: string }>;
}

const has = (q: string, ...fields: Array<string | number>) =>
  fields.some((f) => String(f ?? '').toLowerCase().includes(q));

export function searchAdmin(query: string, d: SearchDatasets): SearchGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const groups: SearchGroup[] = [];

  const artworks = d.artworks.filter((w) => has(q, w.title, w.medium, w.year, w.artistName))
    .map((w): SearchHit => ({ kind: 'artwork', title: w.title, subtitle: `${w.artistName} · ${w.year || ''}`.trim(), href: `/admin/artworks/${w.id}` }));
  if (artworks.length) groups.push({ kind: 'artwork', label: 'Artworks', hits: artworks });

  const artists = d.artists.filter((a) => has(q, a.name, a.discipline))
    .map((a): SearchHit => ({ kind: 'artist', title: a.name, subtitle: a.discipline, href: `/admin/artists/${a.id}` }));
  if (artists.length) groups.push({ kind: 'artist', label: 'Artists', hits: artists });

  const exhibitions = d.exhibitions.filter((e) => has(q, e.title, e.subtitle))
    .map((e): SearchHit => ({ kind: 'exhibition', title: e.title, subtitle: e.subtitle, href: `/admin/exhibitions/${e.id}` }));
  if (exhibitions.length) groups.push({ kind: 'exhibition', label: 'Exhibitions', hits: exhibitions });

  const fairs = d.fairs.filter((f) => has(q, f.name, f.city))
    .map((f): SearchHit => ({ kind: 'fair', title: f.name, subtitle: f.city, href: `/admin/fairs/${f.id}` }));
  if (fairs.length) groups.push({ kind: 'fair', label: 'Art Fairs', hits: fairs });

  const inquiries = d.inquiries.filter((i) => has(q, i.name, i.email, i.message))
    .map((i): SearchHit => ({ kind: 'inquiry', title: i.name, subtitle: i.email, href: `/admin/inquiries/${i.id}` }));
  if (inquiries.length) groups.push({ kind: 'inquiry', label: 'Inquiries', hits: inquiries });

  return groups;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/search.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/search.ts src/lib/search.test.ts
git commit -m "feat(admin): cross-module search logic (TDD)"
```

---

## Task 9: Search results page

**Files:**
- Create: `src/pages/admin/search.astro`
- Modify: `src/styles/admin.css` (append search-group styles)

- [ ] **Step 1: Create `src/pages/admin/search.astro`**

```astro
---
export const prerender = false;
import AdminLayout from '../../layouts/AdminLayout.astro';
import { createSupabaseAdmin } from '../../lib/supabase/server';
import { getArtworks, getArtists, getExhibitions } from '../../lib/gallery';
import { searchAdmin, type SearchDatasets } from '../../lib/search';

const q = Astro.url.searchParams.get('q')?.trim() ?? '';
let groups: ReturnType<typeof searchAdmin> = [];
if (q) {
  const admin = createSupabaseAdmin();
  const [artworksAll, artistsAll, exhibitionsAll, fairsRes, inquiriesRes] = await Promise.all([
    getArtworks(), getArtists(), getExhibitions(),
    admin.from('fairs').select('id,name,city'),
    admin.from('inquiries').select('id,name,email,message'),
  ]);
  const datasets: SearchDatasets = {
    artworks: artworksAll.map((w) => ({ id: w.id, title: w.title, medium: w.medium, year: w.year, artistName: w.artistName })),
    artists: artistsAll.map((a) => ({ id: a.id, name: a.name, discipline: a.discipline })),
    exhibitions: exhibitionsAll.map((e) => ({ id: e.id, title: e.title, subtitle: e.subtitle })),
    fairs: (fairsRes.data ?? []) as SearchDatasets['fairs'],
    inquiries: (inquiriesRes.data ?? []) as SearchDatasets['inquiries'],
  };
  groups = searchAdmin(q, datasets);
}
const total = groups.reduce((n, g) => n + g.hits.length, 0);
---
<AdminLayout title="Search">
  <h1>Search</h1>
  {!q && <p class="admin-empty">Type a search above to find artworks, artists, exhibitions, fairs, or inquiries.</p>}
  {q && <p class="admin-count">{total} {total === 1 ? 'result' : 'results'} for “{q}”.</p>}
  {q && total === 0 && <p class="admin-empty">Nothing matched “{q}”.</p>}
  {groups.map((g) => (
    <section class="search-group">
      <h2 class="dash-h2">{g.label} <span class="admin-count">({g.hits.length})</span></h2>
      <ul class="search-hits">
        {g.hits.map((h) => (
          <li><a href={h.href}><strong>{h.title}</strong>{h.subtitle && <span class="search-sub"> — {h.subtitle}</span>}</a></li>
        ))}
      </ul>
    </section>
  ))}
</AdminLayout>
```

- [ ] **Step 2: Append search styles** to `src/styles/admin.css`:

```css
/* ── Admin search results ─────────────────────────────────────────── */
.search-group { margin-bottom: 1.8rem; }
.search-hits { list-style: none; margin: 0; padding: 0; display: grid; gap: .4rem; max-width: 640px; }
.search-hits li a { display: block; padding: .65rem .9rem; background: var(--mw-panel); border: 1px solid var(--mw-line); border-radius: 8px; color: var(--mw-ink); text-decoration: none; }
.search-hits li a:hover { border-color: var(--mw-accent); }
.search-sub { color: var(--mw-ink-soft); }
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: BUILD OK.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/search.astro src/styles/admin.css
git commit -m "feat(admin): global search results page"
```

---

# GROUP D — Media library

## Task 10: `media` classification logic

**Files:**
- Create: `src/lib/media.ts`
- Test: `src/lib/media.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/media.test.ts
import { describe, it, expect } from 'vitest';
import { collectReferencedUrls, classifyObjects } from './media';

describe('media', () => {
  it('collectReferencedUrls drops nulls/blanks and dedupes', () => {
    const set = collectReferencedUrls({
      artworkImages: ['https://x/a.jpg', null, ''],
      artistPortraits: ['https://x/p.jpg', 'https://x/a.jpg'],
      exhibitionHeroes: [null],
      postCovers: ['https://x/c.jpg'],
    });
    expect(set.has('https://x/a.jpg')).toBe(true);
    expect(set.has('https://x/c.jpg')).toBe(true);
    expect(set.size).toBe(3);
  });
  it('classifyObjects flags in-use via the referenced set', () => {
    const ref = new Set(['https://x/a.jpg']);
    const items = classifyObjects([{ path: 'artworks/a.jpg', url: 'https://x/a.jpg' }, { path: 'library/z.jpg', url: 'https://x/z.jpg' }], ref, '');
    expect(items[0].inUse).toBe(true);
    expect(items[1].inUse).toBe(false);
  });
  it('classifyObjects also flags in-use when the URL appears in page blocks JSON', () => {
    const items = classifyObjects([{ path: 'pages/h.jpg', url: 'https://x/h.jpg' }], new Set(), '[{"type":"hero","src":"https://x/h.jpg"}]');
    expect(items[0].inUse).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/media.test.ts`
Expected: FAIL — cannot find module `./media`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/media.ts
// Pure media-library helpers. The page fetches storage objects + referenced URLs;
// these decide in-use vs orphan.
export interface MediaItem { path: string; url: string; inUse: boolean; }

export interface ReferenceColumns {
  artworkImages: (string | null)[];
  artistPortraits: (string | null)[];
  exhibitionHeroes: (string | null)[];
  postCovers: (string | null)[];
}

export function collectReferencedUrls(refs: ReferenceColumns): Set<string> {
  const set = new Set<string>();
  for (const col of [refs.artworkImages, refs.artistPortraits, refs.exhibitionHeroes, refs.postCovers]) {
    for (const v of col) if (v) set.add(v);
  }
  return set;
}

export function classifyObjects(
  items: Array<{ path: string; url: string }>,
  referenced: Set<string>,
  blocksText: string,
): MediaItem[] {
  return items.map((o) => ({
    ...o,
    inUse: referenced.has(o.url) || (o.url !== '' && blocksText.includes(o.url)),
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/media.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/media.ts src/lib/media.test.ts
git commit -m "feat(admin): media in-use/orphan classification logic (TDD)"
```

---

## Task 11: Allow a `library` upload prefix

**Files:**
- Modify: `src/pages/api/upload.ts:9`

- [ ] **Step 1: Add `library` to the allowed prefixes.** Replace line 9:

```ts
const PREFIXES = new Set(['artworks', 'artists', 'posts', 'cv', 'pages', 'exhibitions', 'library']);
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: BUILD OK.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/upload.ts
git commit -m "feat(admin): allow library/ upload prefix for media library"
```

---

## Task 12: Media library page + delete

**Files:**
- Create: `src/pages/admin/media/index.astro`
- Create: `src/pages/admin/media/action.ts`
- Modify: `src/styles/admin.css` (append media styles)

- [ ] **Step 1: Create `src/pages/admin/media/index.astro`**

```astro
---
export const prerender = false;
import AdminLayout from '../../../layouts/AdminLayout.astro';
import { createSupabaseAdmin } from '../../../lib/supabase/server';
import { collectReferencedUrls, classifyObjects } from '../../../lib/media';

const admin = createSupabaseAdmin();
const PREFIXES = ['artworks', 'artists', 'exhibitions', 'posts', 'pages', 'library'];

// 1. list objects across image prefixes
const objects: Array<{ path: string; url: string }> = [];
for (const prefix of PREFIXES) {
  try {
    const { data } = await admin.storage.from('gallery-images').list(prefix, { limit: 200 });
    for (const obj of data ?? []) {
      if (!obj.name || obj.name.endsWith('/')) continue;
      const path = `${prefix}/${obj.name}`;
      const { data: pub } = admin.storage.from('gallery-images').getPublicUrl(path);
      objects.push({ path, url: pub.publicUrl });
    }
  } catch { /* prefix may not exist yet */ }
}

// 2. gather referenced URLs from the catalogue + page blocks
const [aw, ar, ex, po, pg] = await Promise.all([
  admin.from('artworks').select('image_url'),
  admin.from('artists').select('portrait_image_url'),
  admin.from('exhibitions').select('hero_image_url'),
  admin.from('posts').select('cover_image_url'),
  admin.from('pages').select('blocks,published_blocks'),
]);
const referenced = collectReferencedUrls({
  artworkImages: (aw.data ?? []).map((r: any) => r.image_url),
  artistPortraits: (ar.data ?? []).map((r: any) => r.portrait_image_url),
  exhibitionHeroes: (ex.data ?? []).map((r: any) => r.hero_image_url),
  postCovers: (po.data ?? []).map((r: any) => r.cover_image_url),
});
const blocksText = JSON.stringify(pg.data ?? []);
const items = classifyObjects(objects, referenced, blocksText).sort((a, b) => Number(a.inUse) - Number(b.inUse));

const saved = Astro.url.searchParams.get('deleted');
const error = Astro.url.searchParams.get('error');
---
<AdminLayout title="Media">
  <div class="admin-toolbar">
    <div>
      <h1>Media library</h1>
      <span class="admin-count">{items.length} images · {items.filter((i) => !i.inUse).length} unused</span>
    </div>
    <form method="POST" action="/api/upload" enctype="multipart/form-data" class="admin-field" style="margin:0;">
      <input type="file" id="libFile" data-kind="library" accept="image/jpeg,image/png,image/webp" />
      <input type="hidden" name="kind" value="library" />
    </form>
  </div>
  {saved && <p class="admin-status" style="color:#6b6860;">Deleted.</p>}
  {error && <p class="admin-status err">{error}</p>}

  {items.length === 0 ? (
    <p class="admin-empty">No images yet. Images uploaded through artwork/artist/exhibition forms appear here, and you can upload directly above.</p>
  ) : (
    <div class="admin-grid">
      {items.map((m) => (
        <div class="admin-tile">
          <span class="thumb"><img src={m.url} alt={m.path} loading="lazy" /></span>
          <div class="tmeta">
            <span class={`badge ${m.inUse ? '' : 'inquire'}`}>{m.inUse ? 'In use' : 'Orphan'}</span>
            <div class="tactions">
              <a href={m.url} target="_blank" rel="noopener">Open</a>
              <button type="button" class="tdel media-copy" data-url={m.url}>Copy URL</button>
              <form method="POST" action="/admin/media/action" style="margin-left:auto;"
                onsubmit={`return confirm(${m.inUse ? "'This image is STILL IN USE on the site. Delete anyway?'" : "'Delete this unused image?'"})`}>
                <input type="hidden" name="path" value={m.path} />
                <button type="submit" class="tdel">Delete</button>
              </form>
            </div>
          </div>
        </div>
      ))}
    </div>
  )}
  <script>
    import '../../../scripts/admin-upload.ts';
    document.querySelectorAll<HTMLButtonElement>('.media-copy').forEach((b) => {
      b.addEventListener('click', async () => {
        await navigator.clipboard.writeText(b.dataset.url ?? '');
        const t = b.textContent; b.textContent = 'Copied ✓';
        setTimeout(() => { b.textContent = t; }, 1200);
      });
    });
    // After a direct library upload finishes, reload so the new image appears.
    document.getElementById('libFile')?.addEventListener('change', () => {
      const iv = setInterval(() => {
        const msg = document.querySelector('#libFile')?.closest('.admin-field')?.querySelector('small');
        if (msg && /✓/.test(msg.textContent ?? '')) { clearInterval(iv); location.reload(); }
      }, 500);
      setTimeout(() => clearInterval(iv), 15000);
    });
  </script>
</AdminLayout>
```

- [ ] **Step 2: Create `src/pages/admin/media/action.ts`**

```ts
import type { APIRoute } from 'astro';
import { createSupabaseServer, createSupabaseAdmin } from '../../../lib/supabase/server';
import { okRedirect, errRedirect } from '../../../lib/adminResult';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const auth = createSupabaseServer(cookies, request.headers);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const f = await request.formData();
  const path = String(f.get('path') ?? '');
  if (!path) return redirect(errRedirect('/admin/media', 'No image specified.'), 303);

  const { error } = await createSupabaseAdmin().storage.from('gallery-images').remove([path]);
  if (error) return redirect(errRedirect('/admin/media', error.message), 303);
  return redirect(okRedirect('/admin/media', 'deleted'), 303);
};
```

- [ ] **Step 3: Append media styles** to `src/styles/admin.css`:

```css
/* ── Media library ────────────────────────────────────────────────── */
.admin-tile .thumb img { aspect-ratio: 1 / 1; }
.media-copy { background: none; border: none; cursor: pointer; }
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: BUILD OK.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/media src/styles/admin.css
git commit -m "feat(admin): media library — browse, copy, in-use/orphan, delete (D)"
```

---

# GROUP E — Minimal contact/hours settings

## Task 13: `site_settings` migration

**Files:**
- Modify: `supabase/schema.sql` (append)

- [ ] **Step 1: Append the table + policy + seed row** to `supabase/schema.sql`:

```sql
-- ===== site_settings (contact/hours, editable by the owner) — Phase 4, 2026-06-22 =====
create table if not exists public.site_settings (
  id smallint primary key default 1 check (id = 1),
  email text not null default '',
  phone text not null default '',
  hours text not null default '',
  address_line text not null default '',
  address_city text not null default '',
  instagram_url text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists site_settings_public_read on public.site_settings;
create policy site_settings_public_read on public.site_settings for select using (true);
-- writes via service-role key only (no anon/auth write policy).
insert into public.site_settings (id) values (1) on conflict (id) do nothing;
```

- [ ] **Step 2: Run the migration on the live database.** Paste the appended SQL into the Supabase SQL editor (or `supabase db push`) and run it. Verify one row exists: `select * from public.site_settings;` returns `id = 1`.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(db): site_settings table for owner-editable contact/hours (E)"
```

---

## Task 14: `settings` dual-mode helper

**Files:**
- Create: `src/lib/settings.ts`
- Test: `src/lib/settings.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/settings.test.ts
import { describe, it, expect } from 'vitest';
import { getDefaults, mergeSettings } from './settings';

describe('settings', () => {
  it('getDefaults pulls non-empty contact fields from BRAND', () => {
    const d = getDefaults();
    expect(d.email).toBeTruthy();
    expect(d.hours).toBeTruthy();
    expect(d.addressLine).toBeTruthy();
  });
  it('mergeSettings falls back to defaults for null/blank fields', () => {
    const merged = mergeSettings({ email: 'new@gallery.com', phone: '', hours: '', address_line: '', address_city: '', instagram_url: '' });
    expect(merged.email).toBe('new@gallery.com');
    expect(merged.hours).toBe(getDefaults().hours); // blank → default
  });
  it('mergeSettings(null) equals defaults', () => {
    expect(mergeSettings(null)).toEqual(getDefaults());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/settings.test.ts`
Expected: FAIL — cannot find module `./settings`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/settings.ts
// Owner-editable contact/hours. Dual-mode: DB row merged over BRAND defaults;
// falls back to BRAND when Supabase is unconfigured or on any error.
import { BRAND } from './site';
import { createSupabaseAnon, isSupabaseConfigured } from './supabase/server';

export interface SiteSettings {
  email: string; phone: string; hours: string;
  addressLine: string; addressCity: string; instagramUrl: string;
}

export interface SiteSettingsRow {
  email: string; phone: string; hours: string;
  address_line: string; address_city: string; instagram_url: string;
}

export function getDefaults(): SiteSettings {
  return {
    email: BRAND.email,
    phone: BRAND.phone,
    hours: BRAND.hours,
    addressLine: BRAND.addressLine,
    addressCity: BRAND.addressCity,
    instagramUrl: BRAND.instagram,
  };
}

export function mergeSettings(row: Partial<SiteSettingsRow> | null): SiteSettings {
  const d = getDefaults();
  if (!row) return d;
  const pick = (v: string | undefined, fallback: string) => (v && v.trim() ? v : fallback);
  return {
    email: pick(row.email, d.email),
    phone: pick(row.phone, d.phone),
    hours: pick(row.hours, d.hours),
    addressLine: pick(row.address_line, d.addressLine),
    addressCity: pick(row.address_city, d.addressCity),
    instagramUrl: pick(row.instagram_url, d.instagramUrl),
  };
}

export async function getSettings(): Promise<SiteSettings> {
  if (!isSupabaseConfigured()) return getDefaults();
  try {
    const sb = createSupabaseAnon();
    const { data, error } = await sb.from('site_settings').select('*').eq('id', 1).maybeSingle();
    if (error) throw error;
    return mergeSettings(data as SiteSettingsRow | null);
  } catch {
    return getDefaults();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/settings.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/settings.ts src/lib/settings.test.ts
git commit -m "feat(admin): site settings dual-mode helper (TDD)"
```

---

## Task 15: Settings admin form + save

**Files:**
- Create: `src/pages/admin/settings/index.astro`
- Create: `src/pages/admin/settings/save.ts`

- [ ] **Step 1: Create `src/pages/admin/settings/index.astro`**

```astro
---
export const prerender = false;
import AdminLayout from '../../../layouts/AdminLayout.astro';
import { getSettings } from '../../../lib/settings';

const s = await getSettings();
const saved = Astro.url.searchParams.get('saved');
const error = Astro.url.searchParams.get('error');
---
<AdminLayout title="Settings">
  <h1>Contact &amp; hours</h1>
  <p class="admin-count" style="display:block;margin-bottom:1rem;max-width:60ch;">
    These appear on your Contact page, Visit page, and the footer. Changes go live within about a minute.
  </p>
  {saved && <p class="admin-status" style="color:#5b7a4f;">Saved — your site is updated.</p>}
  {error && <p class="admin-status err">{error}</p>}
  <form method="POST" action="/admin/settings/save" class="admin-card" style="max-width:640px;">
    <div class="admin-field"><label>Gallery email</label><input type="email" name="email" value={s.email} /></div>
    <div class="admin-field"><label>Phone</label><input name="phone" value={s.phone} /></div>
    <div class="admin-field"><label>Opening hours</label><input name="hours" value={s.hours} placeholder="Tue–Sat, 1–6pm" /></div>
    <div class="admin-field"><label>Street address</label><input name="address_line" value={s.addressLine} /></div>
    <div class="admin-field"><label>City line</label><input name="address_city" value={s.addressCity} placeholder="Brooklyn, NY 11201" /></div>
    <div class="admin-field"><label>Instagram URL</label><input name="instagram_url" value={s.instagramUrl} /></div>
    <button class="admin-btn" type="submit">Save changes</button>
  </form>
</AdminLayout>
```

- [ ] **Step 2: Create `src/pages/admin/settings/save.ts`**

```ts
import type { APIRoute } from 'astro';
import { createSupabaseServer, createSupabaseAdmin } from '../../../lib/supabase/server';
import { okRedirect, errRedirect } from '../../../lib/adminResult';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const auth = createSupabaseServer(cookies, request.headers);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const f = await request.formData();
  const fields = {
    id: 1,
    email: String(f.get('email') ?? ''),
    phone: String(f.get('phone') ?? ''),
    hours: String(f.get('hours') ?? ''),
    address_line: String(f.get('address_line') ?? ''),
    address_city: String(f.get('address_city') ?? ''),
    instagram_url: String(f.get('instagram_url') ?? ''),
  };
  const { error } = await createSupabaseAdmin().from('site_settings').upsert(fields);
  if (error) return redirect(errRedirect('/admin/settings', error.message), 303);
  return redirect(okRedirect('/admin/settings'), 303);
};
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: BUILD OK.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/settings
git commit -m "feat(admin): contact/hours settings form (E)"
```

---

## Task 16: Wire public pages to settings

**Files:**
- Modify: `src/components/Footer.astro`
- Modify: `src/pages/contact.astro`
- Modify: `src/pages/visit.astro`

- [ ] **Step 1: Footer** — replace the frontmatter (lines 1-4) of `src/components/Footer.astro` with:

```astro
---
import { BRAND } from '../lib/site';
import { getSettings } from '../lib/settings';
const s = await getSettings();
const year = new Date().getFullYear();
---
```

Then in the markup, swap the contact values: line 23 `{BRAND.addressLine}` → `{s.addressLine}`; line 24 `{BRAND.addressCity}` → `{s.addressCity}`; line 25 `{BRAND.hours}` → `{s.hours}`; line 40 `href={`mailto:${BRAND.email}`}` / `{BRAND.email}` → `href={`mailto:${s.email}`}` / `{s.email}`; line 41 `href={BRAND.instagram}` → `href={s.instagramUrl}`; line 48 `{BRAND.addressLine}, {BRAND.addressCity}` → `{s.addressLine}, {s.addressCity}`. Leave `BRAND.name`, `BRAND.neighborhood`, `BRAND.city` as-is.

- [ ] **Step 2: Contact page** — in `src/pages/contact.astro`, add `export const prerender = false;` and import settings. Replace the frontmatter import block (lines 1-3) with:

```astro
---
export const prerender = false;
import Layout from '../layouts/Layout.astro';
import { BRAND } from '../lib/site';
import { getSettings } from '../lib/settings';
const s = await getSettings();
---
```

Then replace the hardcoded contact rows (lines 25-26) with settings-driven values:

```astro
          <div><dt>Sales &amp; viewings</dt><dd><a class="link-underline" href={`mailto:${s.email}`}>{s.email}</a></dd></div>
          <div><dt>Visit</dt><dd>{s.addressLine}, {s.addressCity}</dd></div>
```

- [ ] **Step 3: Visit page** — in `src/pages/visit.astro`, add `export const prerender = false;` and settings. Replace the frontmatter import (lines 1-2) with:

```astro
---
export const prerender = false;
import Layout from '../layouts/Layout.astro';
import { BRAND } from '../lib/site';
import { getSettings } from '../lib/settings';
const s = await getSettings();
---
```

Then make the visible hours/contact dynamic while leaving the map embed + geo coordinates fixed:
- In the JSON-LD object, set `email: s.email` (replacing `BRAND.email` at line 18).
- Replace the intro sentence (line 50) so the hours come from settings:

```astro
          <p class="lead tldr-block" style="max-width:58ch;">Mazlish + Wright Contemporary is located at {s.addressLine} in DUMBO, Brooklyn. We’re open {s.hours}, with Sunday and Monday by appointment.</p>
```

Leave `mapEmbed`, `mapLink`, `geo`, and `openingHoursSpecification` (structured hours) unchanged — these are not owner-editable by design.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: BUILD OK.

- [ ] **Step 5: Commit**

```bash
git add src/components/Footer.astro src/pages/contact.astro src/pages/visit.astro
git commit -m "feat(site): footer/contact/visit read editable settings (E)"
```

---

# GROUP F — Security hardening

## Task 17: Sanitize artist bio on save

**Files:**
- Modify: `src/pages/admin/artists/save.ts`

- [ ] **Step 1: Import the sanitizer** — add with the other imports in `src/pages/admin/artists/save.ts`:

```ts
import { sanitizeRichHtml } from '../../../lib/sanitize';
```

- [ ] **Step 2: Sanitize the bio field** — change the `bio` line in `fields` (line 23) to:

```ts
    bio: sanitizeRichHtml(String(f.get('bio') ?? '')),
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: BUILD OK.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/artists/save.ts
git commit -m "fix(security): sanitize artist bio on save (F2)"
```

---

## Task 18: Escape the works JSON island

**Files:**
- Modify: `src/pages/works/index.astro:92`

- [ ] **Step 1: Escape `</` in the embedded JSON.** Replace line 92:

```astro
  <script id="works-data" type="application/json" set:html={JSON.stringify(artworks).replace(/<\//g, '<\\/')}></script>
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: BUILD OK.

- [ ] **Step 3: Commit**

```bash
git add src/pages/works/index.astro
git commit -m "fix(security): escape works JSON island to block script breakout (F3)"
```

---

# Final verification

## Task 19: Full suite + browser verification

- [ ] **Step 1: Run the whole unit suite**

Run: `npm test`
Expected: PASS — the original 52 plus the new tests (adminResult 3, dashboard 3, search 4, media 3, settings 3 = 16 new → 68 total).

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: BUILD OK, no TypeScript errors.

- [ ] **Step 3: Browser-verify (dev server) the changed surfaces.** Start the dev server and check, signed in to `/admin`:
  - Nav shows Artworks, Pages, Media, Settings; the omnibox submits to `/admin/search?q=`.
  - Dashboard shows stat counts, the onboarding checklist (items check off against real data), recent inquiries, quick actions — and **no** "viewing rooms/press" copy.
  - `/admin/search?q=<known title>` returns grouped hits that deep-link correctly.
  - `/admin/media` lists images with In use / Orphan badges; Copy URL works; deleting an orphan succeeds and shows "Deleted."; deleting an in-use image shows the extra warning.
  - On an artwork/artist new form, choosing a non-JPEG/PNG/WebP file shows the new error message; the Save button is disabled until "Uploaded ✓".
  - `/admin/settings`: change the hours, save, then confirm the new hours appear on `/visit`, `/contact`, and the footer.
  - Force a save error (e.g. submit a duplicate slug) and confirm a red error banner shows instead of "Saved."

- [ ] **Step 4: Deploy** (per the project convention, after build + tests are green):

```bash
git push origin HEAD:main
```

---

## Spec coverage (self-review)

- Dashboard + checklist → Tasks 6-7 ✓ · Global search → Tasks 5 (omnibox), 8-9 ✓ · Media library (browse/copy/delete/in-use) → Tasks 10-12 ✓
- Audit blockers: U1 nav → Task 5 ✓ · U5 upload accept/error/lock → Tasks 3-4 ✓ · F1 error surfacing → Tasks 1-2 ✓ · U2 contact/hours editor → Tasks 13-16 ✓ · U4 dead dashboard → Task 7 ✓
- Security: F2 bio → Task 17 ✓ · F3 JSON island → Task 18 ✓
- Type consistency verified: `okRedirect/errRedirect` (Task 1) reused in Tasks 2/12/15; `buildChecklist/checklistComplete` (6) used in 7; `searchAdmin/SearchDatasets` (8) used in 9; `collectReferencedUrls/classifyObjects` (10) used in 12; `getSettings/getDefaults/mergeSettings` (14) used in 15/16.
- Not in this plan (tracked separately, non-blocking): public-page N+1 / pagination (audit E1/E2), `tldraw` dead dependency removal, inquiry rate-limit IP source (F6).
