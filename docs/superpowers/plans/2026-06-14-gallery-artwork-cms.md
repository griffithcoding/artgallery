# VERSO Artwork & Artist CMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap the `gallery.ts` data seam for artworks and artists from the static generator to Supabase, and build the `/admin/artworks` + `/admin/artists` CRUD with image upload, so the gallery shows only real, admin-managed works.

**Architecture:** Public reads use a context-free anon Supabase client (RLS allows public SELECT). `gallery.ts` keeps its existing function signatures (from the foundation plan) but queries the DB and maps snake_case rows to the camelCase `Artwork`/`Artist` interfaces, falling back to a generated SVG placeholder when a work has no image. Admin writes go through form-POST endpoints that re-auth and use the service-role client. Exhibitions/fairs/press remain on the generator until their own plan.

**Tech Stack:** Astro 5 SSR, `@supabase/supabase-js`, `@supabase/ssr`, Supabase Storage.

**Prerequisite:** Foundation plan complete and merged; Supabase provisioned with `schema.sql` applied; an admin user exists; `.env` populated.

**Source reference:** doula upload endpoint `C:\Users\wgrif\Projects\TheWildBirthDoulah\src\pages\api\upload.ts`.

---

## File structure

```
src/lib/supabase/server.ts        # MODIFY: add createSupabaseAnon()
src/lib/gallery.ts                # MODIFY: artworks/artists → Supabase
src/lib/mappers.ts                # CREATE: row → interface mappers
src/pages/api/upload.ts           # CREATE: image upload to gallery-images
src/pages/works/index.astro       # MODIFY: empty state
src/pages/artists/index.astro     # MODIFY: empty state
src/pages/admin/artists/index.astro    # CREATE: list
src/pages/admin/artists/new.astro      # CREATE: create form
src/pages/admin/artists/[id].astro     # CREATE: edit form
src/pages/admin/artists/save.ts        # CREATE: upsert handler
src/pages/admin/artists/action.ts      # CREATE: delete handler
src/pages/admin/artworks/index.astro   # CREATE: list
src/pages/admin/artworks/new.astro     # CREATE: create form
src/pages/admin/artworks/[id].astro    # CREATE: edit form
src/pages/admin/artworks/save.ts       # CREATE: upsert handler
src/pages/admin/artworks/action.ts     # CREATE: delete handler
tests/mappers.test.ts             # CREATE
```

---

## Task 1: Add anon client + row→interface mappers

**Files:**
- Modify: `src/lib/supabase/server.ts`
- Create: `src/lib/mappers.ts`
- Test: `tests/mappers.test.ts`

- [ ] **Step 1: Write the failing mapper test**

```ts
// tests/mappers.test.ts
import { describe, it, expect } from 'vitest';
import { rowToArtwork, rowToArtist } from '../src/lib/mappers';

describe('rowToArtwork', () => {
  it('maps row + artist join to the Artwork interface', () => {
    const w = rowToArtwork({
      id: '11', slug: 'low-tide', title: 'Low Tide', artist_id: 'a1',
      year: 2024, medium: 'Oil on canvas', category: 'Painting', subject: 'Abstraction',
      dimensions: '40 × 30 in', ratio: 'portrait', availability: 'Available',
      image_url: 'https://x/img.jpg', featured: false, sort_order: 0,
      created_at: '', updated_at: '',
    }, { id: 'a1', slug: 'mara-okafor', name: 'Mara Okafor' });
    expect(w.artistName).toBe('Mara Okafor');
    expect(w.artistSlug).toBe('mara-okafor');
    expect(w.image).toBe('https://x/img.jpg');
    expect(w.availability).toBe('Available');
  });
  it('falls back to a generated SVG when image_url is null', () => {
    const w = rowToArtwork({
      id: '12', slug: 'no-img', title: 'No Img', artist_id: null,
      year: null, medium: '', category: '', subject: '',
      dimensions: '', ratio: 'square', availability: 'Inquire',
      image_url: null, featured: false, sort_order: 0, created_at: '', updated_at: '',
    }, null);
    expect(w.image.startsWith('data:image/svg+xml')).toBe(true);
    expect(w.artistName).toBe('Unknown artist');
  });
});

describe('rowToArtist', () => {
  it('composes the birth string from birthplace + year', () => {
    const a = rowToArtist({
      id: 'a1', slug: 'mara-okafor', name: 'Mara Okafor', birthplace: 'b. Lagos',
      birth_year: 1980, discipline: 'Painting', bio: 'x', portrait_image_url: null,
      created_at: '', updated_at: '',
    });
    expect(a.birth).toBe('b. Lagos, 1980');
    expect(a.name).toBe('Mara Okafor');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- mappers`
Expected: FAIL ("Cannot find module '../src/lib/mappers'").

- [ ] **Step 3: Create `src/lib/mappers.ts`**

```ts
import { artSVG } from './data';
import type { Artwork, Artist } from './gallery';
import type { ArtworkRow, ArtistRow } from './supabase/types';

type ArtistRef = { id: string; slug: string; name: string } | null;

export function rowToArtwork(r: ArtworkRow, artist: ArtistRef): Artwork {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    artistId: r.artist_id ?? '',
    artistName: artist?.name ?? 'Unknown artist',
    artistSlug: artist?.slug ?? '',
    year: r.year ?? 0,
    medium: r.medium,
    category: r.category,
    subject: r.subject,
    dimensions: r.dimensions,
    ratio: r.ratio,
    availability: r.availability,
    image: r.image_url ?? artSVG(r.id, r.ratio),
  };
}

export function rowToArtist(r: ArtistRow): Artist {
  const birth = [r.birthplace, r.birth_year].filter(Boolean).join(', ');
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    birth,
    discipline: r.discipline,
    bio: r.bio,
  };
}
```

- [ ] **Step 4: Add `createSupabaseAnon()` to `src/lib/supabase/server.ts`**

Append (reuses the `URL`/`ANON` consts already in the file):

```ts
import { createClient } from '@supabase/supabase-js'; // already imported in this file

/** Context-free anon client for public reads (RLS-limited SELECTs). */
export function createSupabaseAnon() {
  return createClient(URL, ANON, { auth: { persistSession: false } });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- mappers`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/mappers.ts src/lib/supabase/server.ts tests/mappers.test.ts
git commit -m "feat: add anon client and row-to-interface mappers"
```

---

## Task 2: Point `gallery.ts` artworks + artists at Supabase

**Files:**
- Modify: `src/lib/gallery.ts`

- [ ] **Step 1: Rewrite the artwork/artist functions** (keep signatures; leave exhibitions/fairs/press on the generator imports)

Replace the bodies of `getArtworks`, `getArtwork`, `getArtists`, `getArtist`, `getWorksByArtist`:

```ts
import { createSupabaseAnon } from './supabase/server';
import { rowToArtwork, rowToArtist } from './mappers';
import type { ArtworkRow, ArtistRow } from './supabase/types';

const ARTWORK_SELECT = '*, artist:artists(id, slug, name)';

export async function getArtworks(): Promise<Artwork[]> {
  const sb = createSupabaseAnon();
  const { data } = await sb.from('artworks').select(ARTWORK_SELECT)
    .order('sort_order', { ascending: true }).order('created_at', { ascending: false });
  return (data ?? []).map((r: any) => rowToArtwork(r as ArtworkRow, r.artist ?? null));
}

export async function getArtwork(slug: string): Promise<Artwork | undefined> {
  const sb = createSupabaseAnon();
  const { data } = await sb.from('artworks').select(ARTWORK_SELECT).eq('slug', slug).maybeSingle();
  if (!data) return undefined;
  return rowToArtwork(data as any as ArtworkRow, (data as any).artist ?? null);
}

export async function getArtists(): Promise<Artist[]> {
  const sb = createSupabaseAnon();
  const { data } = await sb.from('artists').select('*').order('name', { ascending: true });
  return (data ?? []).map((r) => rowToArtist(r as ArtistRow));
}

export async function getArtist(slug: string): Promise<Artist | undefined> {
  const sb = createSupabaseAnon();
  const { data } = await sb.from('artists').select('*').eq('slug', slug).maybeSingle();
  return data ? rowToArtist(data as ArtistRow) : undefined;
}

export async function getWorksByArtist(artistId: string): Promise<Artwork[]> {
  const sb = createSupabaseAnon();
  const { data } = await sb.from('artworks').select(ARTWORK_SELECT)
    .eq('artist_id', artistId).order('sort_order', { ascending: true });
  return (data ?? []).map((r: any) => rowToArtwork(r as ArtworkRow, r.artist ?? null));
}
```

Remove the now-unused generator imports for artworks/artists (`_artworks`, `_artists`) but keep `artSVG`, `CATEGORIES_LIST`, `SUBJECTS_LIST`, and the exhibition/fair/press imports.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Verify against a live DB (insert one test row via Supabase SQL editor)**

In Supabase SQL editor:
```sql
insert into artists (slug, name, discipline, bio) values ('test-artist','Test Artist','Painting','Bio.');
insert into artworks (slug, title, artist_id, year, medium, category, subject, dimensions, ratio, availability)
values ('test-work', 'Test Work', (select id from artists where slug='test-artist'), 2024, 'Oil on canvas', 'Painting', 'Abstraction', '40 × 30 in', 'portrait', 'Available');
```
Run: `npm run dev`; open `/works` (shows Test Work with SVG placeholder) and `/artists` (shows Test Artist).

- [ ] **Step 4: Commit**

```bash
git add src/lib/gallery.ts
git commit -m "feat: serve artworks and artists from Supabase"
```

---

## Task 3: Public empty states

**Files:**
- Modify: `src/pages/works/index.astro`, `src/pages/artists/index.astro`

- [ ] **Step 1: Works empty state** — in `works/index.astro`, after fetching `artworks`, if `artworks.length === 0`, the existing `#empty` block should show. Ensure the embedded JSON is `[]` and the client script shows the empty message. Add a server-rendered fallback above `#results`:

```astro
{artworks.length === 0 && (
  <p class="lead" style="max-width:60ch;">The collection is being prepared. Please check back soon, or <a class="link-underline" href="/contact">get in touch</a> to discuss available works.</p>
)}
```

- [ ] **Step 2: Artists empty state** — in `artists/index.astro`:

```astro
{artists.length === 0 && (
  <p class="lead" style="max-width:60ch;">Artist profiles are coming soon.</p>
)}
```

- [ ] **Step 3: Build + verify with an empty DB** (temporarily delete the test rows, or use a fresh project)

Run: `npm run build && npm run preview`; `/works` and `/artists` show the friendly empty copy, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/works/index.astro src/pages/artists/index.astro
git commit -m "feat: empty states for works and artists"
```

---

## Task 4: Image upload endpoint

**Files:**
- Create: `src/pages/api/upload.ts`

- [ ] **Step 1: Create `src/pages/api/upload.ts`** (adapted from doula; bucket `gallery-images`, path prefix via `kind` field)

```ts
import type { APIRoute } from 'astro';
import { createSupabaseServer, createSupabaseAdmin } from '../../lib/supabase/server';

export const prerender = false;

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX = 5 * 1024 * 1024;
const PREFIXES = new Set(['artworks', 'artists', 'posts']);

export const POST: APIRoute = async ({ request, cookies }) => {
  const auth = createSupabaseServer(cookies, request.headers);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const form = await request.formData();
  const file = form.get('file');
  const kindRaw = String(form.get('kind') ?? 'artworks');
  const kind = PREFIXES.has(kindRaw) ? kindRaw : 'artworks';
  if (!(file instanceof File)) return new Response('No file', { status: 400 });
  if (!ALLOWED.includes(file.type)) return new Response('Bad type', { status: 415 });
  if (file.size > MAX) return new Response('Too large', { status: 413 });

  const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
  const path = `${kind}/${crypto.randomUUID()}.${ext}`;
  const admin = createSupabaseAdmin();
  const { error } = await admin.storage.from('gallery-images')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return new Response(error.message, { status: 500 });

  const { data } = admin.storage.from('gallery-images').getPublicUrl(path);
  return new Response(JSON.stringify({ url: data.publicUrl }), {
    status: 200, headers: { 'content-type': 'application/json' },
  });
};
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/upload.ts
git commit -m "feat: image upload endpoint for gallery-images bucket"
```

---

## Task 5: Admin — Artists CRUD

**Files:**
- Create: `src/pages/admin/artists/index.astro`, `new.astro`, `[id].astro`, `save.ts`, `action.ts`

- [ ] **Step 1: Create `src/pages/admin/artists/save.ts`** (upsert via service role)

```ts
import type { APIRoute } from 'astro';
import { createSupabaseServer, createSupabaseAdmin } from '../../../lib/supabase/server';
import { slugify, uniqueSlug } from '../../../lib/slug';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const auth = createSupabaseServer(cookies, request.headers);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const f = await request.formData();
  const id = String(f.get('id') ?? '');
  const name = String(f.get('name') ?? '').trim();
  if (!name) return new Response('Name required', { status: 400 });

  const admin = createSupabaseAdmin();
  const fields = {
    name,
    birthplace: String(f.get('birthplace') ?? ''),
    birth_year: f.get('birth_year') ? Number(f.get('birth_year')) : null,
    discipline: String(f.get('discipline') ?? ''),
    bio: String(f.get('bio') ?? ''),
    portrait_image_url: String(f.get('portrait_image_url') ?? '') || null,
  };

  if (id) {
    await admin.from('artists').update(fields).eq('id', id);
  } else {
    const { data: existing } = await admin.from('artists').select('slug');
    const slug = uniqueSlug(slugify(name), (existing ?? []).map((r) => r.slug));
    await admin.from('artists').insert({ ...fields, slug });
  }
  return redirect('/admin/artists?saved=1', 303);
};
```

- [ ] **Step 2: Create `src/pages/admin/artists/action.ts`** (delete)

```ts
import type { APIRoute } from 'astro';
import { createSupabaseServer, createSupabaseAdmin } from '../../../lib/supabase/server';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const auth = createSupabaseServer(cookies, request.headers);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  const f = await request.formData();
  const id = String(f.get('id') ?? '');
  if (id) await createSupabaseAdmin().from('artists').delete().eq('id', id);
  return redirect('/admin/artists?deleted=1', 303);
};
```

- [ ] **Step 3: Create `src/pages/admin/artists/index.astro`** (list)

```astro
---
export const prerender = false;
import AdminLayout from '../../../layouts/AdminLayout.astro';
import { createSupabaseAdmin } from '../../../lib/supabase/server';
const { data: artists } = await createSupabaseAdmin().from('artists').select('*').order('name');
const saved = Astro.url.searchParams.get('saved');
---
<AdminLayout title="Artists">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
    <h1 style="font-weight:400;">Artists</h1>
    <a class="admin-btn" href="/admin/artists/new">New artist</a>
  </div>
  {saved && <p class="admin-status" style="color:#9fdca0;">Saved.</p>}
  <div class="admin-card" style="padding:.4rem 1rem;">
    <table class="admin-table">
      <thead><tr><th>Name</th><th>Discipline</th><th style="text-align:right;">Actions</th></tr></thead>
      <tbody>
        {(artists ?? []).map((a) => (
          <tr>
            <td><a href={`/admin/artists/${a.id}`} style="color:#e9e6dc;">{a.name}</a></td>
            <td style="color:#cfc9b8;">{a.discipline}</td>
            <td style="text-align:right;">
              <form method="POST" action="/admin/artists/action" onsubmit="return confirm('Delete this artist?')">
                <input type="hidden" name="id" value={a.id} />
                <button class="admin-btn" style="background:#7a2418;" type="submit">Delete</button>
              </form>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    {(artists ?? []).length === 0 && <p style="padding:1rem .4rem;color:#8a8675;">No artists yet.</p>}
  </div>
</AdminLayout>
```

- [ ] **Step 4: Create `src/pages/admin/artists/new.astro`** (create form)

```astro
---
export const prerender = false;
import AdminLayout from '../../../layouts/AdminLayout.astro';
---
<AdminLayout title="New artist">
  <h1 style="font-weight:400;">New artist</h1>
  <form method="POST" action="/admin/artists/save" class="admin-card" style="max-width:640px;">
    <div class="admin-field"><label>Name</label><input name="name" required /></div>
    <div class="admin-field"><label>Birthplace (e.g. b. Lagos)</label><input name="birthplace" /></div>
    <div class="admin-field"><label>Birth year</label><input name="birth_year" type="number" /></div>
    <div class="admin-field"><label>Discipline</label><input name="discipline" /></div>
    <div class="admin-field"><label>Bio</label><textarea name="bio" rows="5"></textarea></div>
    <div class="admin-field"><label>Portrait image</label>
      <input type="file" id="portraitFile" accept="image/*" />
      <input type="hidden" name="portrait_image_url" id="portraitUrl" />
      <small id="portraitMsg" style="color:#8a8675;"></small>
    </div>
    <button class="admin-btn" type="submit">Create artist</button>
  </form>
  <script src="/src/scripts/admin-upload.ts"></script>
</AdminLayout>
```

- [ ] **Step 5: Create the shared uploader `src/scripts/admin-upload.ts`** (wires any `input[type=file]` with a sibling hidden URL input)

```ts
document.querySelectorAll<HTMLInputElement>('input[type=file]').forEach((input) => {
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    const field = input.closest('.admin-field')!;
    const hidden = field.querySelector<HTMLInputElement>('input[type=hidden]');
    const msg = field.querySelector('small');
    if (msg) msg.textContent = 'Uploading…';
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', input.dataset.kind ?? 'artists');
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!res.ok) { if (msg) msg.textContent = 'Upload failed.'; return; }
    const { url } = await res.json();
    if (hidden) hidden.value = url;
    if (msg) msg.innerHTML = `Uploaded. <a href="${url}" target="_blank" style="color:#cfc9b8;">view</a>`;
  });
});
```

(Set `data-kind="artists"` on the portrait file input and `data-kind="artworks"` on the artwork file input.)

- [ ] **Step 6: Create `src/pages/admin/artists/[id].astro`** (edit form — same fields prefilled, plus hidden `id`)

```astro
---
export const prerender = false;
import AdminLayout from '../../../layouts/AdminLayout.astro';
import { createSupabaseAdmin } from '../../../lib/supabase/server';
const { id } = Astro.params;
const { data: a } = await createSupabaseAdmin().from('artists').select('*').eq('id', id).maybeSingle();
if (!a) return Astro.redirect('/admin/artists', 303);
---
<AdminLayout title={`Edit ${a.name}`}>
  <h1 style="font-weight:400;">Edit artist</h1>
  <form method="POST" action="/admin/artists/save" class="admin-card" style="max-width:640px;">
    <input type="hidden" name="id" value={a.id} />
    <div class="admin-field"><label>Name</label><input name="name" value={a.name} required /></div>
    <div class="admin-field"><label>Birthplace</label><input name="birthplace" value={a.birthplace} /></div>
    <div class="admin-field"><label>Birth year</label><input name="birth_year" type="number" value={a.birth_year ?? ''} /></div>
    <div class="admin-field"><label>Discipline</label><input name="discipline" value={a.discipline} /></div>
    <div class="admin-field"><label>Bio</label><textarea name="bio" rows="5">{a.bio}</textarea></div>
    <div class="admin-field"><label>Portrait image</label>
      <input type="file" data-kind="artists" accept="image/*" />
      <input type="hidden" name="portrait_image_url" value={a.portrait_image_url ?? ''} />
      <small style="color:#8a8675;">{a.portrait_image_url ? 'Current image kept unless you upload a new one.' : ''}</small>
    </div>
    <button class="admin-btn" type="submit">Save changes</button>
  </form>
  <script src="/src/scripts/admin-upload.ts"></script>
</AdminLayout>
```

- [ ] **Step 7: Build + manual CRUD test**

Run: `npm run dev`
- `/admin/artists/new` → fill, upload portrait, create → appears in list and on public `/artists`.
- Edit, then delete.

- [ ] **Step 8: Commit**

```bash
git add src/pages/admin/artists src/scripts/admin-upload.ts
git commit -m "feat: admin artists CRUD with portrait upload"
```

---

## Task 6: Admin — Artworks CRUD

**Files:**
- Create: `src/pages/admin/artworks/index.astro`, `new.astro`, `[id].astro`, `save.ts`, `action.ts`

- [ ] **Step 1: Create `src/pages/admin/artworks/save.ts`**

```ts
import type { APIRoute } from 'astro';
import { createSupabaseServer, createSupabaseAdmin } from '../../../lib/supabase/server';
import { slugify, uniqueSlug } from '../../../lib/slug';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const auth = createSupabaseServer(cookies, request.headers);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const f = await request.formData();
  const id = String(f.get('id') ?? '');
  const title = String(f.get('title') ?? '').trim();
  if (!title) return new Response('Title required', { status: 400 });

  const admin = createSupabaseAdmin();
  const fields = {
    title,
    artist_id: String(f.get('artist_id') ?? '') || null,
    year: f.get('year') ? Number(f.get('year')) : null,
    medium: String(f.get('medium') ?? ''),
    category: String(f.get('category') ?? ''),
    subject: String(f.get('subject') ?? ''),
    dimensions: String(f.get('dimensions') ?? ''),
    ratio: String(f.get('ratio') ?? 'square'),
    availability: String(f.get('availability') ?? 'Available'),
    image_url: String(f.get('image_url') ?? '') || null,
    featured: f.get('featured') === 'on',
    sort_order: f.get('sort_order') ? Number(f.get('sort_order')) : 0,
  };

  if (id) {
    await admin.from('artworks').update(fields).eq('id', id);
  } else {
    const { data: existing } = await admin.from('artworks').select('slug');
    const slug = uniqueSlug(slugify(title), (existing ?? []).map((r) => r.slug));
    await admin.from('artworks').insert({ ...fields, slug });
  }
  return redirect('/admin/artworks?saved=1', 303);
};
```

- [ ] **Step 2: Create `src/pages/admin/artworks/action.ts`** (delete — identical pattern to artists, table `artworks`, redirect `/admin/artworks?deleted=1`)

```ts
import type { APIRoute } from 'astro';
import { createSupabaseServer, createSupabaseAdmin } from '../../../lib/supabase/server';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const auth = createSupabaseServer(cookies, request.headers);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  const f = await request.formData();
  const id = String(f.get('id') ?? '');
  if (id) await createSupabaseAdmin().from('artworks').delete().eq('id', id);
  return redirect('/admin/artworks?deleted=1', 303);
};
```

- [ ] **Step 3: Create `src/pages/admin/artworks/index.astro`** (list with artist name + availability)

```astro
---
export const prerender = false;
import AdminLayout from '../../../layouts/AdminLayout.astro';
import { createSupabaseAdmin } from '../../../lib/supabase/server';
const { data: works } = await createSupabaseAdmin()
  .from('artworks').select('id, title, availability, artist:artists(name)')
  .order('created_at', { ascending: false });
const saved = Astro.url.searchParams.get('saved');
---
<AdminLayout title="Artworks">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
    <h1 style="font-weight:400;">Artworks</h1>
    <a class="admin-btn" href="/admin/artworks/new">New artwork</a>
  </div>
  {saved && <p class="admin-status" style="color:#9fdca0;">Saved.</p>}
  <div class="admin-card" style="padding:.4rem 1rem;">
    <table class="admin-table">
      <thead><tr><th>Title</th><th>Artist</th><th>Availability</th><th style="text-align:right;">Actions</th></tr></thead>
      <tbody>
        {(works ?? []).map((w: any) => (
          <tr>
            <td><a href={`/admin/artworks/${w.id}`} style="color:#e9e6dc;">{w.title}</a></td>
            <td style="color:#cfc9b8;">{w.artist?.name ?? '—'}</td>
            <td style="color:#cfc9b8;">{w.availability}</td>
            <td style="text-align:right;">
              <form method="POST" action="/admin/artworks/action" onsubmit="return confirm('Delete this artwork?')">
                <input type="hidden" name="id" value={w.id} />
                <button class="admin-btn" style="background:#7a2418;" type="submit">Delete</button>
              </form>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    {(works ?? []).length === 0 && <p style="padding:1rem .4rem;color:#8a8675;">No artworks yet.</p>}
  </div>
</AdminLayout>
```

- [ ] **Step 4: Create a shared artwork form partial inline in `new.astro`**

```astro
---
export const prerender = false;
import AdminLayout from '../../../layouts/AdminLayout.astro';
import { createSupabaseAdmin } from '../../../lib/supabase/server';
import { categories, subjects } from '../../../lib/gallery';
const { data: artists } = await createSupabaseAdmin().from('artists').select('id, name').order('name');
const RATIOS = ['portrait', 'landscape', 'square', 'tall'];
const AVAIL = ['Available', 'Inquire', 'Sold'];
---
<AdminLayout title="New artwork">
  <h1 style="font-weight:400;">New artwork</h1>
  <form method="POST" action="/admin/artworks/save" class="admin-card" style="max-width:680px;">
    <div class="admin-field"><label>Title</label><input name="title" required /></div>
    <div class="admin-field"><label>Artist</label>
      <select name="artist_id"><option value="">— none —</option>
        {(artists ?? []).map((a) => <option value={a.id}>{a.name}</option>)}
      </select></div>
    <div class="admin-field"><label>Year</label><input name="year" type="number" /></div>
    <div class="admin-field"><label>Medium</label><input name="medium" /></div>
    <div class="admin-field"><label>Category</label>
      <select name="category">{categories.map((c) => <option value={c}>{c}</option>)}</select></div>
    <div class="admin-field"><label>Subject</label>
      <select name="subject">{subjects.map((s) => <option value={s}>{s}</option>)}</select></div>
    <div class="admin-field"><label>Dimensions</label><input name="dimensions" placeholder="40 × 30 in" /></div>
    <div class="admin-field"><label>Ratio</label>
      <select name="ratio">{RATIOS.map((r) => <option value={r}>{r}</option>)}</select></div>
    <div class="admin-field"><label>Availability</label>
      <select name="availability">{AVAIL.map((a) => <option value={a}>{a}</option>)}</select></div>
    <div class="admin-field"><label>Sort order</label><input name="sort_order" type="number" value="0" /></div>
    <div class="admin-field"><label><input type="checkbox" name="featured" /> Featured on home page</label></div>
    <div class="admin-field"><label>Image</label>
      <input type="file" data-kind="artworks" accept="image/*" />
      <input type="hidden" name="image_url" />
      <small style="color:#8a8675;">No image → a generated placeholder is shown.</small>
    </div>
    <button class="admin-btn" type="submit">Create artwork</button>
  </form>
  <script src="/src/scripts/admin-upload.ts"></script>
</AdminLayout>
```

- [ ] **Step 5: Create `src/pages/admin/artworks/[id].astro`** (edit — same fields prefilled with `selected`/`value`, hidden `id`, current `image_url` preserved)

```astro
---
export const prerender = false;
import AdminLayout from '../../../layouts/AdminLayout.astro';
import { createSupabaseAdmin } from '../../../lib/supabase/server';
import { categories, subjects } from '../../../lib/gallery';
const { id } = Astro.params;
const sb = createSupabaseAdmin();
const { data: w } = await sb.from('artworks').select('*').eq('id', id).maybeSingle();
if (!w) return Astro.redirect('/admin/artworks', 303);
const { data: artists } = await sb.from('artists').select('id, name').order('name');
const RATIOS = ['portrait', 'landscape', 'square', 'tall'];
const AVAIL = ['Available', 'Inquire', 'Sold'];
---
<AdminLayout title={`Edit ${w.title}`}>
  <h1 style="font-weight:400;">Edit artwork</h1>
  <form method="POST" action="/admin/artworks/save" class="admin-card" style="max-width:680px;">
    <input type="hidden" name="id" value={w.id} />
    <div class="admin-field"><label>Title</label><input name="title" value={w.title} required /></div>
    <div class="admin-field"><label>Artist</label>
      <select name="artist_id"><option value="">— none —</option>
        {(artists ?? []).map((a) => <option value={a.id} selected={a.id === w.artist_id}>{a.name}</option>)}
      </select></div>
    <div class="admin-field"><label>Year</label><input name="year" type="number" value={w.year ?? ''} /></div>
    <div class="admin-field"><label>Medium</label><input name="medium" value={w.medium} /></div>
    <div class="admin-field"><label>Category</label>
      <select name="category">{categories.map((c) => <option value={c} selected={c === w.category}>{c}</option>)}</select></div>
    <div class="admin-field"><label>Subject</label>
      <select name="subject">{subjects.map((s) => <option value={s} selected={s === w.subject}>{s}</option>)}</select></div>
    <div class="admin-field"><label>Dimensions</label><input name="dimensions" value={w.dimensions} /></div>
    <div class="admin-field"><label>Ratio</label>
      <select name="ratio">{RATIOS.map((r) => <option value={r} selected={r === w.ratio}>{r}</option>)}</select></div>
    <div class="admin-field"><label>Availability</label>
      <select name="availability">{AVAIL.map((a) => <option value={a} selected={a === w.availability}>{a}</option>)}</select></div>
    <div class="admin-field"><label>Sort order</label><input name="sort_order" type="number" value={w.sort_order} /></div>
    <div class="admin-field"><label><input type="checkbox" name="featured" checked={w.featured} /> Featured on home page</label></div>
    <div class="admin-field"><label>Image</label>
      <input type="file" data-kind="artworks" accept="image/*" />
      <input type="hidden" name="image_url" value={w.image_url ?? ''} />
      <small style="color:#8a8675;">{w.image_url ? 'Current image kept unless you upload a new one.' : 'No image → placeholder.'}</small>
    </div>
    <button class="admin-btn" type="submit">Save changes</button>
  </form>
  <script src="/src/scripts/admin-upload.ts"></script>
</AdminLayout>
```

- [ ] **Step 6: Build + full manual CRUD test**

Run: `npm run dev`
- Create an artwork with an artist + image → appears on `/works`, detail page renders, inquire button works.
- Create one without an image → placeholder SVG shows.
- Set one `Featured` → appears on home selected-works.
- Edit availability to Sold → detail shows Sold, inquire disabled.
- Delete.

- [ ] **Step 7: Commit**

```bash
git add src/pages/admin/artworks
git commit -m "feat: admin artworks CRUD with image upload and artist link"
```

---

## Task 7: Home featured works use the `featured` flag

**Files:**
- Modify: `src/pages/index.astro`, `src/lib/gallery.ts`

- [ ] **Step 1: Add `getFeaturedArtworks` to `gallery.ts`**

```ts
export async function getFeaturedArtworks(limit = 8): Promise<Artwork[]> {
  const sb = createSupabaseAnon();
  const { data } = await sb.from('artworks').select(ARTWORK_SELECT)
    .eq('featured', true).order('sort_order', { ascending: true }).limit(limit);
  const rows = (data ?? []);
  if (rows.length) return rows.map((r: any) => rowToArtwork(r as ArtworkRow, r.artist ?? null));
  // fallback: newest works
  return (await getArtworks()).slice(0, limit);
}
```

- [ ] **Step 2: Use it in `index.astro`** — replace `const works = (await getArtworks()).slice(0, 8);` with `const works = await getFeaturedArtworks(8);`.

- [ ] **Step 3: Build + verify** featured works appear on home.

Run: `npm run build && npm run preview`

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro src/lib/gallery.ts
git commit -m "feat: home page uses featured artwork flag"
```

---

## Self-review (completed during authoring)

**Spec coverage:** Artwork CMS (Tasks 5–6), Artist CMS (Task 5), image upload to `gallery-images` (Task 4), public works/artists served from DB (Task 2) with empty states (Task 3), featured-on-home (Task 7). Availability control is a form field; price is absent throughout (consistent with the prior price-removal work).

**Placeholder scan:** No TBD/vague steps. Delete handlers are shown in full for both artists and artworks (not "similar to") because table names and redirects differ.

**Type consistency:** `rowToArtwork`/`rowToArtist` consume `ArtworkRow`/`ArtistRow` (from foundation `types.ts`) and produce `Artwork`/`Artist` (from foundation `gallery.ts`). `ARTWORK_SELECT` join alias `artist` is read as `r.artist` everywhere. Form field names (`artist_id`, `availability`, `featured`, `sort_order`, `image_url`) match `save.ts` parsing and `schema.sql` columns.
