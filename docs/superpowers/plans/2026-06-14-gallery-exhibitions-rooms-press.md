# VERSO Exhibitions / Viewing Rooms / Fairs / Press Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move exhibitions, fairs, viewing rooms, and press mentions off the static generator and onto Supabase, and add admin CRUD for each, so all program content is owner-managed.

**Architecture:** Same seam + form-POST CRUD pattern as the Artwork CMS plan. `gallery.ts` functions keep their signatures; new mappers compose the display shapes (e.g. an exhibition's `dates` string + `year` from `start_date`/`end_date`, linked `artistIds` from the join table). Public pages already consume these functions, so they update automatically.

**Tech Stack:** Astro 5 SSR, Supabase. Tables `exhibitions`, `exhibition_artists`, `fairs`, `viewing_rooms`, `viewing_room_artworks`, `press_mentions` from the foundation schema.

**Prerequisite:** Foundation + Artwork CMS plans complete (viewing rooms link to artworks; exhibitions link to artists). Admin auth works.

---

## File structure

```
src/lib/mappers.ts                 # MODIFY: add rowToExhibition
src/lib/gallery.ts                 # MODIFY: exhibitions/fairs/press/rooms → Supabase; PressItem gains url; ViewingRoom type
src/pages/viewing-rooms/index.astro # MODIFY: render DB rooms
src/pages/admin/exhibitions/{index,new,[id],save,action}    # CREATE
src/pages/admin/fairs/{index,new,[id],save,action}          # CREATE
src/pages/admin/press/{index,new,[id],save,action}          # CREATE
src/pages/admin/viewing-rooms/{index,new,[id],save,action}  # CREATE
tests/mappers.test.ts              # MODIFY: add exhibition mapping test
```

---

## Task 1: Exhibition mapper + date formatting

**Files:**
- Modify: `src/lib/mappers.ts`, `tests/mappers.test.ts`

- [ ] **Step 1: Add the failing test** to `tests/mappers.test.ts`

```ts
import { rowToExhibition } from '../src/lib/mappers';

describe('rowToExhibition', () => {
  it('composes dates and year from start/end and includes artist ids', () => {
    const e = rowToExhibition({
      id: 'e1', slug: 'soft-architecture', title: 'Soft Architecture',
      subtitle: 'New paintings', status: 'On View',
      start_date: '2026-05-22', end_date: '2026-07-12', blurb: 'x',
      sort_order: 0, created_at: '', updated_at: '',
    }, ['a1', 'a3']);
    expect(e.year).toBe(2026);
    expect(e.dates).toBe('May 22 – Jul 12, 2026');
    expect(e.artistIds).toEqual(['a1', 'a3']);
  });
  it('handles a missing end date', () => {
    const e = rowToExhibition({
      id: 'e2', slug: 's', title: 'T', subtitle: '', status: 'Upcoming',
      start_date: '2026-09-01', end_date: null, blurb: '', sort_order: 0,
      created_at: '', updated_at: '',
    }, []);
    expect(e.dates).toBe('Sep 1, 2026');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- mappers`
Expected: FAIL ("rowToExhibition is not a function").

- [ ] **Step 3: Add `rowToExhibition` to `src/lib/mappers.ts`**

```ts
import type { ExhibitionRow } from './supabase/types';
import type { Exhibition } from './gallery';

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function rowToExhibition(r: ExhibitionRow, artistIds: string[]): Exhibition {
  const startYear = r.start_date ? new Date(r.start_date + 'T00:00:00').getFullYear() : 0;
  let dates = '';
  if (r.start_date && r.end_date) dates = `${fmtDate(r.start_date)} – ${fmtDate(r.end_date)}, ${startYear}`;
  else if (r.start_date) dates = `${fmtDate(r.start_date)}, ${startYear}`;
  return {
    id: r.id, slug: r.slug, title: r.title, subtitle: r.subtitle,
    status: r.status, dates, year: startYear, artistIds, blurb: r.blurb,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- mappers`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mappers.ts tests/mappers.test.ts
git commit -m "feat: exhibition row mapper with date composition"
```

---

## Task 2: Point gallery.ts exhibitions/fairs/press/rooms at Supabase

**Files:**
- Modify: `src/lib/gallery.ts`

- [ ] **Step 1: Extend the `PressItem` interface and add a `ViewingRoom` type**

```ts
export interface PressItem { outlet: string; headline: string; date: string; kind: string; url: string; }
export interface ViewingRoom { id: string; slug: string; title: string; description: string; artworks: Artwork[]; }
```

- [ ] **Step 2: Replace exhibition/fair/press function bodies and add viewing-room functions**

```ts
import { rowToExhibition } from './mappers';
import type { ExhibitionRow, FairRow, PressMentionRow } from './supabase/types';

export async function getExhibitions(): Promise<Exhibition[]> {
  const sb = createSupabaseAnon();
  const { data } = await sb.from('exhibitions')
    .select('*, exhibition_artists(artist_id)')
    .order('sort_order', { ascending: true }).order('start_date', { ascending: false });
  return (data ?? []).map((r: any) =>
    rowToExhibition(r as ExhibitionRow, (r.exhibition_artists ?? []).map((j: any) => j.artist_id)));
}

export async function getExhibition(slug: string): Promise<Exhibition | undefined> {
  const sb = createSupabaseAnon();
  const { data } = await sb.from('exhibitions')
    .select('*, exhibition_artists(artist_id)').eq('slug', slug).maybeSingle();
  if (!data) return undefined;
  return rowToExhibition(data as any as ExhibitionRow,
    ((data as any).exhibition_artists ?? []).map((j: any) => j.artist_id));
}

export async function getFairs(): Promise<Fair[]> {
  const sb = createSupabaseAnon();
  const { data } = await sb.from('fairs').select('*').order('sort_order', { ascending: true });
  return (data ?? []).map((r) => ({
    name: r.name, city: r.city, booth: r.booth, dates: r.dates, status: r.status,
  }));
}

export async function getPress(): Promise<PressItem[]> {
  const sb = createSupabaseAnon();
  const { data } = await sb.from('press_mentions').select('*').order('sort_order', { ascending: true });
  return (data ?? []).map((r) => ({
    outlet: r.outlet, headline: r.headline, date: r.date, kind: r.kind, url: r.url,
  }));
}

export async function getViewingRooms(): Promise<ViewingRoom[]> {
  const sb = createSupabaseAnon();
  const { data } = await sb.from('viewing_rooms')
    .select('*, viewing_room_artworks(position, artwork:artworks(*, artist:artists(id, slug, name)))')
    .order('sort_order', { ascending: true });
  return (data ?? []).map((r: any) => ({
    id: r.id, slug: r.slug, title: r.title, description: r.description,
    artworks: (r.viewing_room_artworks ?? [])
      .sort((a: any, b: any) => a.position - b.position)
      .map((j: any) => rowToArtwork(j.artwork as ArtworkRow, j.artwork?.artist ?? null)),
  }));
}
```

Remove the now-unused generator imports (`_exhibitions`, `_fairs`, `_press`). Keep `artSVG`, `categories`, `subjects`.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds. Note: `exhibitions/index.astro` and `press.astro` already call `getExhibitions`/`getFairs`/`getPress`; they keep working with the new source.

- [ ] **Step 4: Seed one row of each via Supabase SQL editor, then verify**

```sql
insert into exhibitions (slug, title, subtitle, status, start_date, end_date, blurb)
values ('soft-architecture','Soft Architecture','New paintings','On View','2026-05-22','2026-07-12','A group exhibition.');
insert into fairs (name, city, booth, dates, status) values ('The Armory Show','New York','Booth 214','Sep 4 – 7, 2026','Upcoming');
insert into press_mentions (outlet, headline, url, date, kind) values ('Artforum','VERSO review','https://example.com','June 2026','Review');
```
Run: `npm run dev`; check `/exhibitions`, `/exhibitions/soft-architecture`, `/press`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gallery.ts
git commit -m "feat: serve exhibitions, fairs, press, viewing rooms from Supabase"
```

---

## Task 3: Public viewing-rooms page uses DB rooms

**Files:**
- Modify: `src/pages/viewing-rooms/index.astro`

- [ ] **Step 1: Replace the hardcoded room list with `getViewingRooms()`**

```astro
---
import Layout from '../../layouts/Layout.astro';
import ArtworkCard from '../../components/ArtworkCard.astro';
import { getViewingRooms } from '../../lib/gallery';
const rooms = await getViewingRooms();
---
<Layout title="Viewing Rooms — Curated Collections | VERSO Gallery Brooklyn"
  description="Online viewing rooms from VERSO Gallery — curated, themed selections from the collection.">
  <main class="wrap section">
    <!-- paste the viewing-rooms.html header markup -->
    {rooms.length === 0 && <p class="lead">Curated viewing rooms are coming soon.</p>}
    <div id="rooms">
      {rooms.map((room) => (
        <section style="border-top:1px solid var(--line);padding-block:clamp(2rem,5vw,3.5rem);">
          <header style="margin-bottom:1.5rem;">
            <h2 class="display">{room.title}</h2>
            <p class="lead" style="max-width:60ch;">{room.description}</p>
            <a class="link-underline" href={`/works`}>View related works →</a>
          </header>
          <div class="grid">{room.artworks.slice(0, 4).map((w) => <ArtworkCard work={w} />)}</div>
        </section>
      ))}
    </div>
  </main>
</Layout>
```

- [ ] **Step 2: Build + verify** (after a room is created in Task 7)

Run: `npm run build`
Expected: succeeds; `/viewing-rooms` shows empty-state until a room exists.

- [ ] **Step 3: Commit**

```bash
git add src/pages/viewing-rooms/index.astro
git commit -m "feat: viewing rooms page renders DB-managed rooms"
```

---

## Task 4: Admin — Exhibitions CRUD (with artist links)

**Files:**
- Create: `src/pages/admin/exhibitions/{index.astro,new.astro,[id].astro,save.ts,action.ts}`

- [ ] **Step 1: Create `save.ts`** (upsert + replace artist links)

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
  const artistIds = f.getAll('artist_ids').map(String).filter(Boolean);

  const admin = createSupabaseAdmin();
  const fields = {
    title,
    subtitle: String(f.get('subtitle') ?? ''),
    status: String(f.get('status') ?? 'Upcoming'),
    start_date: String(f.get('start_date') ?? '') || null,
    end_date: String(f.get('end_date') ?? '') || null,
    blurb: String(f.get('blurb') ?? ''),
    sort_order: f.get('sort_order') ? Number(f.get('sort_order')) : 0,
  };

  let exId = id;
  if (id) {
    await admin.from('exhibitions').update(fields).eq('id', id);
  } else {
    const { data: existing } = await admin.from('exhibitions').select('slug');
    const slug = uniqueSlug(slugify(title), (existing ?? []).map((r) => r.slug));
    const { data: inserted } = await admin.from('exhibitions').insert({ ...fields, slug }).select('id').single();
    exId = inserted!.id;
  }
  // replace artist links
  await admin.from('exhibition_artists').delete().eq('exhibition_id', exId);
  if (artistIds.length) {
    await admin.from('exhibition_artists').insert(artistIds.map((aid) => ({ exhibition_id: exId, artist_id: aid })));
  }
  return redirect('/admin/exhibitions?saved=1', 303);
};
```

- [ ] **Step 2: Create `action.ts`** (delete)

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
  if (id) await createSupabaseAdmin().from('exhibitions').delete().eq('id', id);
  return redirect('/admin/exhibitions?deleted=1', 303);
};
```

- [ ] **Step 3: Create `index.astro`** (list)

```astro
---
export const prerender = false;
import AdminLayout from '../../../layouts/AdminLayout.astro';
import { createSupabaseAdmin } from '../../../lib/supabase/server';
const { data: rows } = await createSupabaseAdmin().from('exhibitions').select('*').order('start_date', { ascending: false });
---
<AdminLayout title="Exhibitions">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
    <h1 style="font-weight:400;">Exhibitions</h1><a class="admin-btn" href="/admin/exhibitions/new">New exhibition</a>
  </div>
  <div class="admin-card" style="padding:.4rem 1rem;">
    <table class="admin-table">
      <thead><tr><th>Title</th><th>Status</th><th style="text-align:right;">Actions</th></tr></thead>
      <tbody>{(rows ?? []).map((r) => (
        <tr>
          <td><a href={`/admin/exhibitions/${r.id}`} style="color:#e9e6dc;">{r.title}</a></td>
          <td style="color:#cfc9b8;">{r.status}</td>
          <td style="text-align:right;">
            <form method="POST" action="/admin/exhibitions/action" onsubmit="return confirm('Delete?')">
              <input type="hidden" name="id" value={r.id} /><button class="admin-btn" style="background:#7a2418;">Delete</button>
            </form>
          </td>
        </tr>))}</tbody>
    </table>
    {(rows ?? []).length === 0 && <p style="padding:1rem .4rem;color:#8a8675;">No exhibitions yet.</p>}
  </div>
</AdminLayout>
```

- [ ] **Step 4: Create `new.astro`** (form with multi-select artists)

```astro
---
export const prerender = false;
import AdminLayout from '../../../layouts/AdminLayout.astro';
import { createSupabaseAdmin } from '../../../lib/supabase/server';
const { data: artists } = await createSupabaseAdmin().from('artists').select('id, name').order('name');
const STATUS = ['On View', 'Upcoming', 'Past'];
---
<AdminLayout title="New exhibition">
  <h1 style="font-weight:400;">New exhibition</h1>
  <form method="POST" action="/admin/exhibitions/save" class="admin-card" style="max-width:680px;">
    <div class="admin-field"><label>Title</label><input name="title" required /></div>
    <div class="admin-field"><label>Subtitle</label><input name="subtitle" /></div>
    <div class="admin-field"><label>Status</label><select name="status">{STATUS.map((s) => <option value={s}>{s}</option>)}</select></div>
    <div class="admin-field"><label>Start date</label><input name="start_date" type="date" /></div>
    <div class="admin-field"><label>End date</label><input name="end_date" type="date" /></div>
    <div class="admin-field"><label>Blurb</label><textarea name="blurb" rows="4"></textarea></div>
    <div class="admin-field"><label>Sort order</label><input name="sort_order" type="number" value="0" /></div>
    <div class="admin-field"><label>Artists (Ctrl/Cmd-click to select multiple)</label>
      <select name="artist_ids" multiple size="6">{(artists ?? []).map((a) => <option value={a.id}>{a.name}</option>)}</select></div>
    <button class="admin-btn" type="submit">Create exhibition</button>
  </form>
</AdminLayout>
```

- [ ] **Step 5: Create `[id].astro`** (edit; prefill fields + selected artists)

```astro
---
export const prerender = false;
import AdminLayout from '../../../layouts/AdminLayout.astro';
import { createSupabaseAdmin } from '../../../lib/supabase/server';
const { id } = Astro.params;
const sb = createSupabaseAdmin();
const { data: e } = await sb.from('exhibitions').select('*, exhibition_artists(artist_id)').eq('id', id).maybeSingle();
if (!e) return Astro.redirect('/admin/exhibitions', 303);
const { data: artists } = await sb.from('artists').select('id, name').order('name');
const selected = new Set(((e as any).exhibition_artists ?? []).map((j: any) => j.artist_id));
const STATUS = ['On View', 'Upcoming', 'Past'];
---
<AdminLayout title={`Edit ${e.title}`}>
  <h1 style="font-weight:400;">Edit exhibition</h1>
  <form method="POST" action="/admin/exhibitions/save" class="admin-card" style="max-width:680px;">
    <input type="hidden" name="id" value={e.id} />
    <div class="admin-field"><label>Title</label><input name="title" value={e.title} required /></div>
    <div class="admin-field"><label>Subtitle</label><input name="subtitle" value={e.subtitle} /></div>
    <div class="admin-field"><label>Status</label><select name="status">{STATUS.map((s) => <option value={s} selected={s === e.status}>{s}</option>)}</select></div>
    <div class="admin-field"><label>Start date</label><input name="start_date" type="date" value={e.start_date ?? ''} /></div>
    <div class="admin-field"><label>End date</label><input name="end_date" type="date" value={e.end_date ?? ''} /></div>
    <div class="admin-field"><label>Blurb</label><textarea name="blurb" rows="4">{e.blurb}</textarea></div>
    <div class="admin-field"><label>Sort order</label><input name="sort_order" type="number" value={e.sort_order} /></div>
    <div class="admin-field"><label>Artists</label>
      <select name="artist_ids" multiple size="6">{(artists ?? []).map((a) => <option value={a.id} selected={selected.has(a.id)}>{a.name}</option>)}</select></div>
    <button class="admin-btn" type="submit">Save changes</button>
  </form>
</AdminLayout>
```

- [ ] **Step 6: Build + manual CRUD test** (create with 2 artists → appears on `/exhibitions` + detail lists artists; edit; delete).

Run: `npm run dev`

- [ ] **Step 7: Commit**

```bash
git add src/pages/admin/exhibitions
git commit -m "feat: admin exhibitions CRUD with artist links"
```

---

## Task 5: Admin — Fairs CRUD

**Files:**
- Create: `src/pages/admin/fairs/{index.astro,new.astro,[id].astro,save.ts,action.ts}`

- [ ] **Step 1: Create `save.ts`**

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
  const fields = {
    name: String(f.get('name') ?? '').trim(),
    city: String(f.get('city') ?? ''),
    booth: String(f.get('booth') ?? ''),
    dates: String(f.get('dates') ?? ''),
    status: String(f.get('status') ?? 'Upcoming'),
    sort_order: f.get('sort_order') ? Number(f.get('sort_order')) : 0,
  };
  if (!fields.name) return new Response('Name required', { status: 400 });
  const admin = createSupabaseAdmin();
  if (id) await admin.from('fairs').update(fields).eq('id', id);
  else await admin.from('fairs').insert(fields);
  return redirect('/admin/fairs?saved=1', 303);
};
```

- [ ] **Step 2: Create `action.ts`** (delete; table `fairs`, redirect `/admin/fairs?deleted=1` — same shape as exhibitions action.ts but table=`fairs`)

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
  if (id) await createSupabaseAdmin().from('fairs').delete().eq('id', id);
  return redirect('/admin/fairs?deleted=1', 303);
};
```

- [ ] **Step 3: Create `index.astro`** (list — columns Name/City/Status; New button → `/admin/fairs/new`; delete form → `/admin/fairs/action`; follow the exhibitions index structure with table `fairs` fields `name`, `city`, `status`)

- [ ] **Step 4: Create `new.astro`** (fields: name [required], city, booth, dates [text, e.g. "Sep 4 – 7, 2026"], status [Upcoming/Past select], sort_order; action `/admin/fairs/save`)

```astro
---
export const prerender = false;
import AdminLayout from '../../../layouts/AdminLayout.astro';
const STATUS = ['Upcoming', 'Past'];
---
<AdminLayout title="New fair">
  <h1 style="font-weight:400;">New art fair</h1>
  <form method="POST" action="/admin/fairs/save" class="admin-card" style="max-width:640px;">
    <div class="admin-field"><label>Name</label><input name="name" required /></div>
    <div class="admin-field"><label>City</label><input name="city" /></div>
    <div class="admin-field"><label>Booth</label><input name="booth" /></div>
    <div class="admin-field"><label>Dates</label><input name="dates" placeholder="Sep 4 – 7, 2026" /></div>
    <div class="admin-field"><label>Status</label><select name="status">{STATUS.map((s) => <option value={s}>{s}</option>)}</select></div>
    <div class="admin-field"><label>Sort order</label><input name="sort_order" type="number" value="0" /></div>
    <button class="admin-btn" type="submit">Create fair</button>
  </form>
</AdminLayout>
```

- [ ] **Step 5: Create `[id].astro`** (edit — prefill the same fields with `value`/`selected`, hidden `id`, action `/admin/fairs/save`)

- [ ] **Step 6: Build + manual CRUD test** (create a fair → appears under the fairs section of `/exhibitions`).

Run: `npm run dev`

- [ ] **Step 7: Commit**

```bash
git add src/pages/admin/fairs
git commit -m "feat: admin fairs CRUD"
```

---

## Task 6: Admin — Press mentions CRUD

**Files:**
- Create: `src/pages/admin/press/{index.astro,new.astro,[id].astro,save.ts,action.ts}`

- [ ] **Step 1: Create `save.ts`**

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
  const fields = {
    outlet: String(f.get('outlet') ?? '').trim(),
    headline: String(f.get('headline') ?? '').trim(),
    url: String(f.get('url') ?? ''),
    date: String(f.get('date') ?? ''),
    kind: String(f.get('kind') ?? 'Feature'),
    sort_order: f.get('sort_order') ? Number(f.get('sort_order')) : 0,
  };
  if (!fields.outlet || !fields.headline) return new Response('Outlet and headline required', { status: 400 });
  const admin = createSupabaseAdmin();
  if (id) await admin.from('press_mentions').update(fields).eq('id', id);
  else await admin.from('press_mentions').insert(fields);
  return redirect('/admin/press?saved=1', 303);
};
```

- [ ] **Step 2: Create `action.ts`** (delete; table `press_mentions`, redirect `/admin/press?deleted=1`)

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
  if (id) await createSupabaseAdmin().from('press_mentions').delete().eq('id', id);
  return redirect('/admin/press?deleted=1', 303);
};
```

- [ ] **Step 3: Create `index.astro`** (list — columns Outlet/Headline/Kind; New → `/admin/press/new`; delete → `/admin/press/action`; mirror the exhibitions index structure with `press_mentions` fields)

- [ ] **Step 4: Create `new.astro`**

```astro
---
export const prerender = false;
import AdminLayout from '../../../layouts/AdminLayout.astro';
const KIND = ['Review', 'Feature', 'Listing', 'Profile'];
---
<AdminLayout title="New press mention">
  <h1 style="font-weight:400;">New press mention</h1>
  <form method="POST" action="/admin/press/save" class="admin-card" style="max-width:640px;">
    <div class="admin-field"><label>Outlet</label><input name="outlet" required /></div>
    <div class="admin-field"><label>Headline</label><input name="headline" required /></div>
    <div class="admin-field"><label>URL</label><input name="url" type="url" /></div>
    <div class="admin-field"><label>Date (e.g. June 2026)</label><input name="date" /></div>
    <div class="admin-field"><label>Kind</label><select name="kind">{KIND.map((k) => <option value={k}>{k}</option>)}</select></div>
    <div class="admin-field"><label>Sort order</label><input name="sort_order" type="number" value="0" /></div>
    <button class="admin-btn" type="submit">Create mention</button>
  </form>
</AdminLayout>
```

- [ ] **Step 5: Create `[id].astro`** (edit — same fields prefilled, hidden `id`, action `/admin/press/save`)

- [ ] **Step 6: Ensure the public `press.astro` renders the link** — if a mention has a `url`, wrap the headline in `<a href={item.url}>`. Update `press.astro` markup accordingly.

- [ ] **Step 7: Build + manual CRUD test** (create a mention with a URL → appears on `/press` as a link).

Run: `npm run dev`

- [ ] **Step 8: Commit**

```bash
git add src/pages/admin/press src/pages/press.astro
git commit -m "feat: admin press mentions CRUD"
```

---

## Task 7: Admin — Viewing rooms CRUD (with artwork links)

**Files:**
- Create: `src/pages/admin/viewing-rooms/{index.astro,new.astro,[id].astro,save.ts,action.ts}`

- [ ] **Step 1: Create `save.ts`** (upsert + replace artwork links, preserving order from the multi-select)

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
  const artworkIds = f.getAll('artwork_ids').map(String).filter(Boolean);

  const admin = createSupabaseAdmin();
  const fields = {
    title,
    description: String(f.get('description') ?? ''),
    sort_order: f.get('sort_order') ? Number(f.get('sort_order')) : 0,
  };

  let roomId = id;
  if (id) {
    await admin.from('viewing_rooms').update(fields).eq('id', id);
  } else {
    const { data: existing } = await admin.from('viewing_rooms').select('slug');
    const slug = uniqueSlug(slugify(title), (existing ?? []).map((r) => r.slug));
    const { data: inserted } = await admin.from('viewing_rooms').insert({ ...fields, slug }).select('id').single();
    roomId = inserted!.id;
  }
  await admin.from('viewing_room_artworks').delete().eq('viewing_room_id', roomId);
  if (artworkIds.length) {
    await admin.from('viewing_room_artworks').insert(
      artworkIds.map((aid, i) => ({ viewing_room_id: roomId, artwork_id: aid, position: i })));
  }
  return redirect('/admin/viewing-rooms?saved=1', 303);
};
```

- [ ] **Step 2: Create `action.ts`** (delete; table `viewing_rooms`, redirect `/admin/viewing-rooms?deleted=1`)

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
  if (id) await createSupabaseAdmin().from('viewing_rooms').delete().eq('id', id);
  return redirect('/admin/viewing-rooms?deleted=1', 303);
};
```

- [ ] **Step 3: Create `index.astro`** (list — columns Title/Sort; New → `/admin/viewing-rooms/new`; delete → `/admin/viewing-rooms/action`; mirror exhibitions index with `viewing_rooms` fields)

- [ ] **Step 4: Create `new.astro`** (title, description, sort_order, artwork multi-select)

```astro
---
export const prerender = false;
import AdminLayout from '../../../layouts/AdminLayout.astro';
import { createSupabaseAdmin } from '../../../lib/supabase/server';
const { data: works } = await createSupabaseAdmin().from('artworks').select('id, title, artist:artists(name)').order('title');
---
<AdminLayout title="New viewing room">
  <h1 style="font-weight:400;">New viewing room</h1>
  <form method="POST" action="/admin/viewing-rooms/save" class="admin-card" style="max-width:680px;">
    <div class="admin-field"><label>Title</label><input name="title" required /></div>
    <div class="admin-field"><label>Description</label><textarea name="description" rows="3"></textarea></div>
    <div class="admin-field"><label>Sort order</label><input name="sort_order" type="number" value="0" /></div>
    <div class="admin-field"><label>Artworks (Ctrl/Cmd-click; selection order = display order)</label>
      <select name="artwork_ids" multiple size="10">
        {(works ?? []).map((w: any) => <option value={w.id}>{w.title}{w.artist?.name ? ` — ${w.artist.name}` : ''}</option>)}
      </select></div>
    <button class="admin-btn" type="submit">Create viewing room</button>
  </form>
</AdminLayout>
```

- [ ] **Step 5: Create `[id].astro`** (edit — prefill title/description/sort_order; mark selected artworks from the join. Note: native multi-select selection order is not preserved on edit; positions are re-assigned from DOM order on save, which matches option order. Document this limitation in a small note under the field.)

```astro
---
export const prerender = false;
import AdminLayout from '../../../layouts/AdminLayout.astro';
import { createSupabaseAdmin } from '../../../lib/supabase/server';
const { id } = Astro.params;
const sb = createSupabaseAdmin();
const { data: room } = await sb.from('viewing_rooms')
  .select('*, viewing_room_artworks(artwork_id)').eq('id', id).maybeSingle();
if (!room) return Astro.redirect('/admin/viewing-rooms', 303);
const { data: works } = await sb.from('artworks').select('id, title, artist:artists(name)').order('title');
const selected = new Set(((room as any).viewing_room_artworks ?? []).map((j: any) => j.artwork_id));
---
<AdminLayout title={`Edit ${room.title}`}>
  <h1 style="font-weight:400;">Edit viewing room</h1>
  <form method="POST" action="/admin/viewing-rooms/save" class="admin-card" style="max-width:680px;">
    <input type="hidden" name="id" value={room.id} />
    <div class="admin-field"><label>Title</label><input name="title" value={room.title} required /></div>
    <div class="admin-field"><label>Description</label><textarea name="description" rows="3">{room.description}</textarea></div>
    <div class="admin-field"><label>Sort order</label><input name="sort_order" type="number" value={room.sort_order} /></div>
    <div class="admin-field"><label>Artworks</label>
      <select name="artwork_ids" multiple size="10">
        {(works ?? []).map((w: any) => <option value={w.id} selected={selected.has(w.id)}>{w.title}{w.artist?.name ? ` — ${w.artist.name}` : ''}</option>)}
      </select>
      <small style="color:#8a8675;">Display order follows the list order above.</small>
    </div>
    <button class="admin-btn" type="submit">Save changes</button>
  </form>
</AdminLayout>
```

- [ ] **Step 6: Build + manual CRUD test** (create a room with 4 works → appears on `/viewing-rooms` with those works; edit; delete).

Run: `npm run dev`

- [ ] **Step 7: Commit**

```bash
git add src/pages/admin/viewing-rooms
git commit -m "feat: admin viewing rooms CRUD with artwork links"
```

---

## Self-review (completed during authoring)

**Spec coverage:** Exhibitions CRUD + artist links (Task 4) and public render (Task 2); fairs CRUD (Task 5) on the existing `/exhibitions` fairs section; press mentions CRUD (Task 6) + public links (Task 6 Step 6); viewing rooms CRUD + artwork links (Task 7) + public render (Task 3). All four moved off the generator (Task 2).

**Placeholder scan:** Index/edit pages for fairs/press/rooms that mirror an already-fully-shown structure say exactly which fields/routes change and reference the concrete shape; the join-heavy and form-bearing files have complete code. No "add validation/error handling" hand-waving. The native-multiselect order limitation is called out explicitly rather than left ambiguous.

**Type consistency:** `rowToExhibition(ExhibitionRow, string[])` → `Exhibition` (matches foundation interface fields `dates`/`year`/`artistIds`). `getViewingRooms` returns the new `ViewingRoom` type consumed by `viewing-rooms/index.astro`. `PressItem.url` added in Task 2 and consumed in Task 6. Join aliases (`exhibition_artists`, `viewing_room_artworks`, `artwork`/`artist`) are read consistently. Form field names (`artist_ids`, `artwork_ids`, `start_date`, etc.) match the `save.ts` parsing and schema columns.
