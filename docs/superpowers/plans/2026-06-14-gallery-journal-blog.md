# VERSO Journal Blog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a rich-text journal: an admin posts CMS (TipTap editor, draft/publish, cover image, server-sanitized HTML) and a public `/journal` index + `/journal/[slug]` reader.

**Architecture:** The `posts` table (foundation schema) holds sanitized HTML bodies. Public reads use the anon client (RLS exposes only `status='published'`); admin reads/writes use the service-role client. The editor is TipTap, bundled into a client script that serializes HTML into a hidden field; the server re-sanitizes with `sanitizeRichHtml` on every save (never trust the client).

**Tech Stack:** Astro 5 SSR, Supabase, TipTap (`@tiptap/core`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-image`, `@tiptap/pm`), `sanitize-html`.

**Prerequisite:** Foundation plan complete (`posts` table, `sanitize.ts`, `slug.ts`, `createSupabaseAnon`/`createSupabaseAdmin`, `/api/upload` with `kind=posts`). The upload endpoint already allows the `posts` prefix (Artwork CMS plan Task 4); if that plan isn't done, add `'posts'` to the endpoint's `PREFIXES` set.

**Source reference:** doula posts lib `C:\Users\wgrif\Projects\TheWildBirthDoulah\src\lib\posts.ts` and posts pages under `src/pages/admin/posts/`.

---

## File structure

```
package.json                       # MODIFY: add tiptap deps
src/lib/posts.ts                   # CREATE: published/admin queries
src/components/admin/PostForm.astro # CREATE: editor form
src/scripts/editor.ts              # CREATE: TipTap init + toolbar
src/pages/journal/index.astro      # CREATE: public list
src/pages/journal/[slug].astro     # CREATE: public reader
src/pages/admin/posts/index.astro  # CREATE: admin list
src/pages/admin/posts/new.astro    # CREATE
src/pages/admin/posts/[id].astro   # CREATE
src/pages/admin/posts/save.ts      # CREATE: upsert (sanitize body)
src/pages/admin/posts/action.ts    # CREATE: publish/unpublish/delete
src/components/Footer.astro        # MODIFY: add Journal link
tests/posts.test.ts                # CREATE: excerpt/readingTime helpers
```

---

## Task 1: Add TipTap dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add deps** to `package.json` dependencies:

```json
"@tiptap/core": "^3.26.0",
"@tiptap/extension-image": "^3.26.0",
"@tiptap/extension-link": "^3.26.0",
"@tiptap/pm": "^3.26.0",
"@tiptap/starter-kit": "^3.26.0",
```

- [ ] **Step 2: Install**

Run: `npm install`
Expected: installs without errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add TipTap editor dependencies"
```

---

## Task 2: Posts query lib + helpers

**Files:**
- Create: `src/lib/posts.ts`
- Test: `tests/posts.test.ts`

- [ ] **Step 1: Write the failing helper test**

```ts
// tests/posts.test.ts
import { describe, it, expect } from 'vitest';
import { excerpt, readingTime } from '../src/lib/posts';

describe('excerpt', () => {
  it('strips tags and truncates with ellipsis', () => {
    const html = '<p>' + 'word '.repeat(60) + '</p>';
    const e = excerpt(html, 20);
    expect(e).not.toContain('<');
    expect(e.endsWith('…')).toBe(true);
    expect(e.split(' ').length).toBeLessThanOrEqual(21);
  });
  it('returns short text unchanged (no ellipsis)', () => {
    expect(excerpt('<p>Hello there</p>', 20)).toBe('Hello there');
  });
});

describe('readingTime', () => {
  it('estimates minutes at ~200 wpm', () => {
    expect(readingTime('<p>' + 'word '.repeat(400) + '</p>')).toBe('2 min read');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- posts`
Expected: FAIL ("Cannot find module '../src/lib/posts'").

- [ ] **Step 3: Create `src/lib/posts.ts`**

```ts
import { createSupabaseAnon, createSupabaseAdmin } from './supabase/server';
import type { PostRow } from './supabase/types';

export function excerpt(html: string, words = 40): string {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const parts = text.split(' ');
  if (parts.length <= words) return text;
  return parts.slice(0, words).join(' ') + '…';
}

export function readingTime(html: string): string {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const count = text ? text.split(' ').length : 0;
  return `${Math.max(1, Math.round(count / 200))} min read`;
}

export async function getPublishedPosts(): Promise<PostRow[]> {
  const sb = createSupabaseAnon();
  const { data } = await sb.from('posts').select('*')
    .eq('status', 'published').order('published_at', { ascending: false });
  return (data ?? []) as PostRow[];
}

export async function getPublishedPost(slug: string): Promise<PostRow | null> {
  const sb = createSupabaseAnon();
  const { data } = await sb.from('posts').select('*')
    .eq('status', 'published').eq('slug', slug).maybeSingle();
  return (data as PostRow) ?? null;
}

export async function adminListPosts(): Promise<PostRow[]> {
  const sb = createSupabaseAdmin();
  const { data } = await sb.from('posts').select('*').order('updated_at', { ascending: false });
  return (data ?? []) as PostRow[];
}

export async function adminGetPost(id: string): Promise<PostRow | null> {
  const sb = createSupabaseAdmin();
  const { data } = await sb.from('posts').select('*').eq('id', id).maybeSingle();
  return (data as PostRow) ?? null;
}

export async function allPostSlugs(excludeId?: string): Promise<string[]> {
  const sb = createSupabaseAdmin();
  const { data } = await sb.from('posts').select('id, slug');
  return (data ?? []).filter((r) => r.id !== excludeId).map((r) => r.slug as string);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- posts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/posts.ts tests/posts.test.ts
git commit -m "feat: posts query lib with excerpt and reading-time helpers"
```

---

## Task 3: TipTap editor script + PostForm

**Files:**
- Create: `src/scripts/editor.ts`, `src/components/admin/PostForm.astro`

- [ ] **Step 1: Create `src/scripts/editor.ts`** (TipTap init, toolbar, image upload, serialize to hidden field)

```ts
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';

const mount = document.getElementById('editor');
const hidden = document.getElementById('body') as HTMLInputElement | null;
if (mount && hidden) {
  const editor = new Editor({
    element: mount,
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      Image,
    ],
    content: hidden.value || '<p></p>',
    onUpdate: ({ editor }) => { hidden.value = editor.getHTML(); },
  });
  hidden.value = editor.getHTML();

  const exec: Record<string, () => void> = {
    bold: () => editor.chain().focus().toggleBold().run(),
    italic: () => editor.chain().focus().toggleItalic().run(),
    h2: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    h3: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    ul: () => editor.chain().focus().toggleBulletList().run(),
    ol: () => editor.chain().focus().toggleOrderedList().run(),
    quote: () => editor.chain().focus().toggleBlockquote().run(),
    link: () => {
      const url = prompt('Link URL');
      if (url) editor.chain().focus().setLink({ href: url }).run();
      else editor.chain().focus().unsetLink().run();
    },
    image: async () => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*';
      input.onchange = async () => {
        const file = input.files?.[0]; if (!file) return;
        const fd = new FormData(); fd.append('file', file); fd.append('kind', 'posts');
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        if (res.ok) { const { url } = await res.json(); editor.chain().focus().setImage({ src: url }).run(); }
      };
      input.click();
    },
  };
  document.querySelectorAll<HTMLButtonElement>('[data-cmd]').forEach((b) => {
    b.addEventListener('click', (e) => { e.preventDefault(); exec[b.dataset.cmd!]?.(); });
  });
}
```

- [ ] **Step 2: Create `src/components/admin/PostForm.astro`** (used by both new + edit)

```astro
---
import type { PostRow } from '../../lib/supabase/types';
interface Props { post?: Partial<PostRow>; }
const { post = {} } = Astro.props;
const CATEGORY = ['Journal', 'Press', 'Exhibitions'];
---
<form method="POST" action="/admin/posts/save" class="admin-card" style="max-width:760px;">
  {post.id && <input type="hidden" name="id" value={post.id} />}
  <div class="admin-field"><label>Title</label><input name="title" value={post.title ?? ''} required /></div>
  <div class="admin-field"><label>Description (for listings + SEO)</label><input name="description" value={post.description ?? ''} /></div>
  <div class="admin-field"><label>Category</label>
    <select name="category">{CATEGORY.map((c) => <option value={c} selected={c === post.category}>{c}</option>)}</select></div>
  <div class="admin-field"><label>Cover image</label>
    <input type="file" data-kind="posts" accept="image/*" />
    <input type="hidden" name="cover_image_url" value={post.cover_image_url ?? ''} />
    <small style="color:#8a8675;">{post.cover_image_url ? 'Current cover kept unless you upload a new one.' : ''}</small>
  </div>
  <div class="admin-field"><label>Body</label>
    <div class="editor-toolbar" style="display:flex;gap:.35rem;flex-wrap:wrap;margin-bottom:.4rem;">
      <button class="admin-btn" style="background:#2c2a20;" data-cmd="bold">B</button>
      <button class="admin-btn" style="background:#2c2a20;" data-cmd="italic">i</button>
      <button class="admin-btn" style="background:#2c2a20;" data-cmd="h2">H2</button>
      <button class="admin-btn" style="background:#2c2a20;" data-cmd="h3">H3</button>
      <button class="admin-btn" style="background:#2c2a20;" data-cmd="ul">• List</button>
      <button class="admin-btn" style="background:#2c2a20;" data-cmd="ol">1. List</button>
      <button class="admin-btn" style="background:#2c2a20;" data-cmd="quote">&ldquo;</button>
      <button class="admin-btn" style="background:#2c2a20;" data-cmd="link">Link</button>
      <button class="admin-btn" style="background:#2c2a20;" data-cmd="image">Image</button>
    </div>
    <div id="editor" style="background:#11100b;border:1px solid #3a382b;min-height:280px;padding:.75rem;border-radius:3px;"></div>
    <input type="hidden" name="body" id="body" value={post.body ?? ''} />
  </div>
  <div style="display:flex;gap:.5rem;">
    <button class="admin-btn" type="submit" name="status" value="draft">Save draft</button>
    <button class="admin-btn" type="submit" name="status" value="published" style="background:#1c3a3a;">Publish</button>
  </div>
</form>
<script src="/src/scripts/editor.ts"></script>
<style>
  #editor .ProseMirror { outline: none; color: #e9e6dc; }
  #editor .ProseMirror p { margin: 0 0 .8rem; }
  #editor img { max-width: 100%; height: auto; }
</style>
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds; TipTap bundles into the client script.

- [ ] **Step 4: Commit**

```bash
git add src/scripts/editor.ts src/components/admin/PostForm.astro
git commit -m "feat: TipTap editor script and reusable post form"
```

---

## Task 4: Save + action endpoints (sanitize on save)

**Files:**
- Create: `src/pages/admin/posts/save.ts`, `src/pages/admin/posts/action.ts`

- [ ] **Step 1: Create `src/pages/admin/posts/save.ts`** (upsert; server-side sanitize; set `published_at` on first publish)

```ts
import type { APIRoute } from 'astro';
import { createSupabaseServer, createSupabaseAdmin } from '../../../lib/supabase/server';
import { sanitizeRichHtml } from '../../../lib/sanitize';
import { slugify, uniqueSlug } from '../../../lib/slug';
import { allPostSlugs } from '../../../lib/posts';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const auth = createSupabaseServer(cookies, request.headers);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const f = await request.formData();
  const id = String(f.get('id') ?? '');
  const title = String(f.get('title') ?? '').trim();
  if (!title) return new Response('Title required', { status: 400 });
  const status = String(f.get('status') ?? 'draft') === 'published' ? 'published' : 'draft';

  const admin = createSupabaseAdmin();
  const base = {
    title,
    description: String(f.get('description') ?? ''),
    category: String(f.get('category') ?? 'Journal'),
    cover_image_url: String(f.get('cover_image_url') ?? '') || null,
    body: sanitizeRichHtml(String(f.get('body') ?? '')),
    status,
  };

  if (id) {
    // set published_at the first time it goes public
    const { data: existing } = await admin.from('posts').select('published_at, status').eq('id', id).maybeSingle();
    const published_at = status === 'published'
      ? (existing?.published_at ?? new Date().toISOString())
      : existing?.published_at ?? null;
    await admin.from('posts').update({ ...base, published_at }).eq('id', id);
  } else {
    const slug = uniqueSlug(slugify(title), await allPostSlugs());
    const published_at = status === 'published' ? new Date().toISOString() : null;
    await admin.from('posts').insert({ ...base, slug, published_at });
  }
  return redirect('/admin/posts?saved=1', 303);
};
```

- [ ] **Step 2: Create `src/pages/admin/posts/action.ts`** (toggle publish / delete)

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
  const kind = String(f.get('kind') ?? '');
  const admin = createSupabaseAdmin();
  if (!id) return redirect('/admin/posts', 303);

  if (kind === 'delete') {
    await admin.from('posts').delete().eq('id', id);
  } else if (kind === 'status') {
    const status = String(f.get('status') ?? 'draft') === 'published' ? 'published' : 'draft';
    const { data: existing } = await admin.from('posts').select('published_at').eq('id', id).maybeSingle();
    const published_at = status === 'published' ? (existing?.published_at ?? new Date().toISOString()) : existing?.published_at ?? null;
    await admin.from('posts').update({ status, published_at }).eq('id', id);
  }
  return redirect('/admin/posts?saved=1', 303);
};
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/posts/save.ts src/pages/admin/posts/action.ts
git commit -m "feat: post save (sanitized) and publish/delete endpoints"
```

---

## Task 5: Admin posts list + new + edit pages

**Files:**
- Create: `src/pages/admin/posts/index.astro`, `new.astro`, `[id].astro`

- [ ] **Step 1: Create `src/pages/admin/posts/index.astro`** (adapted from doula list — title/status/category/updated + publish-toggle + delete)

```astro
---
export const prerender = false;
import AdminLayout from '../../../layouts/AdminLayout.astro';
import { adminListPosts } from '../../../lib/posts';
const posts = await adminListPosts();
const saved = Astro.url.searchParams.get('saved');
const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
---
<AdminLayout title="Journal">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
    <h1 style="font-weight:400;">Journal</h1><a class="admin-btn" href="/admin/posts/new">New post</a>
  </div>
  {saved && <p class="admin-status" style="color:#9fdca0;">Saved.</p>}
  <div class="admin-card" style="padding:.4rem 1rem;">
    <table class="admin-table">
      <thead><tr><th>Title</th><th>Status</th><th>Category</th><th>Updated</th><th style="text-align:right;">Actions</th></tr></thead>
      <tbody>{posts.map((p) => (
        <tr>
          <td><a href={`/admin/posts/${p.id}`} style="color:#e9e6dc;">{p.title}</a></td>
          <td style="color:#cfc9b8;">{p.status}</td>
          <td style="color:#cfc9b8;">{p.category}</td>
          <td style="color:#cfc9b8;">{fmt(p.updated_at)}</td>
          <td><div style="display:flex;gap:.4rem;justify-content:flex-end;">
            <form method="POST" action="/admin/posts/action">
              <input type="hidden" name="kind" value="status" /><input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="status" value={p.status === 'published' ? 'draft' : 'published'} />
              <button class="admin-btn" style="background:#2c2a20;">{p.status === 'published' ? 'Unpublish' : 'Publish'}</button>
            </form>
            <form method="POST" action="/admin/posts/action" onsubmit="return confirm('Delete this post?')">
              <input type="hidden" name="kind" value="delete" /><input type="hidden" name="id" value={p.id} />
              <button class="admin-btn" style="background:#7a2418;">Delete</button>
            </form>
          </div></td>
        </tr>))}</tbody>
    </table>
    {posts.length === 0 && <p style="padding:1rem .4rem;color:#8a8675;">No posts yet — write your first one.</p>}
  </div>
</AdminLayout>
```

- [ ] **Step 2: Create `src/pages/admin/posts/new.astro`**

```astro
---
export const prerender = false;
import AdminLayout from '../../../layouts/AdminLayout.astro';
import PostForm from '../../../components/admin/PostForm.astro';
---
<AdminLayout title="New post"><PostForm /></AdminLayout>
```

- [ ] **Step 3: Create `src/pages/admin/posts/[id].astro`**

```astro
---
export const prerender = false;
import AdminLayout from '../../../layouts/AdminLayout.astro';
import PostForm from '../../../components/admin/PostForm.astro';
import { adminGetPost } from '../../../lib/posts';
const { id } = Astro.params;
const post = await adminGetPost(id!);
if (!post) return Astro.redirect('/admin/posts', 303);
---
<AdminLayout title={`Edit ${post.title}`}><PostForm post={post} /></AdminLayout>
```

- [ ] **Step 4: Build + manual test**

Run: `npm run dev`
- `/admin/posts/new` → write a post with bold/heading/link/image, Save draft → appears in list as draft.
- Open it, Publish → status flips, `published_at` set.
- Verify a `<script>` in the body is stripped (paste raw HTML via the link/image only — confirm sanitization by checking the stored `body`).

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/posts/index.astro src/pages/admin/posts/new.astro "src/pages/admin/posts/[id].astro"
git commit -m "feat: admin journal posts list, create, and edit"
```

---

## Task 6: Public journal index + reader

**Files:**
- Create: `src/pages/journal/index.astro`, `src/pages/journal/[slug].astro`
- Modify: `src/components/Footer.astro`

- [ ] **Step 1: Create `src/pages/journal/index.astro`**

```astro
---
import Layout from '../../layouts/Layout.astro';
import { getPublishedPosts, excerpt } from '../../lib/posts';
const posts = await getPublishedPosts();
const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
---
<Layout title="Journal — VERSO Gallery" description="Essays, exhibition notes, and press from VERSO Gallery, Brooklyn.">
  <main class="wrap section">
    <header style="margin-bottom:2.5rem;">
      <p class="eyebrow">Journal</p>
      <h1 class="display" style="font-size:clamp(2.2rem,5vw,3.5rem);">Notes from the gallery</h1>
    </header>
    {posts.length === 0 && <p class="lead">The journal is just getting started — check back soon.</p>}
    <div class="grid">
      {posts.map((p) => (
        <a class="art-card reveal is-visible" href={`/journal/${p.slug}`}>
          {p.cover_image_url && <span class="frame frame--hover" data-ratio="landscape"><img src={p.cover_image_url} alt={p.title} loading="lazy" /></span>}
          <span class="artist-name">{p.category} · {fmt(p.published_at)}</span>
          <span class="art-title">{p.title}</span>
          <div class="art-meta">{p.description || excerpt(p.body, 24)}</div>
        </a>
      ))}
    </div>
  </main>
</Layout>
```

- [ ] **Step 2: Create `src/pages/journal/[slug].astro`** (renders sanitized body via `set:html`; body is already sanitized at save time)

```astro
---
import Layout from '../../layouts/Layout.astro';
import { getPublishedPost, readingTime } from '../../lib/posts';
const { slug } = Astro.params;
const post = await getPublishedPost(slug!);
if (!post) return new Response(null, { status: 404 });
const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
const jsonLd = {
  "@context": "https://schema.org", "@type": "Article",
  "headline": post.title, "datePublished": post.published_at,
  "author": { "@type": "Organization", "name": "VERSO Gallery" },
  "image": post.cover_image_url ?? undefined,
};
---
<Layout title={`${post.title} — VERSO Journal`} description={post.description} ogImage={post.cover_image_url ?? undefined} jsonLd={jsonLd}>
  <main class="wrap section" style="max-width:720px;">
    <p><a class="link-underline" href="/journal">← Journal</a></p>
    <p class="eyebrow">{post.category} · {fmt(post.published_at)} · {readingTime(post.body)}</p>
    <h1 class="display" style="margin:.4rem 0 1.4rem;">{post.title}</h1>
    {post.cover_image_url && <img src={post.cover_image_url} alt={post.title} style="width:100%;height:auto;margin-bottom:1.6rem;" />}
    <div class="prose" set:html={post.body} />
  </main>
</Layout>
```

- [ ] **Step 3: Add a Journal link to `Footer.astro`** — in the "Explore" list, add `<li><a href="/journal">Journal</a></li>`.

- [ ] **Step 4: Build + manual test**

Run: `npm run build && npm run preview`
- `/journal` lists published posts only (drafts hidden).
- A draft's `/journal/<slug>` returns 404; after publishing, it renders with formatted body.

- [ ] **Step 5: Commit**

```bash
git add src/pages/journal src/components/Footer.astro
git commit -m "feat: public journal index and reader"
```

---

## Self-review (completed during authoring)

**Spec coverage:** TipTap rich editor (Task 3), draft/publish + cover image (Tasks 3–5), server sanitization on save (Task 4), admin posts CRUD (Tasks 4–5), public `/journal` + `/journal/[slug]` (Task 6), Journal nav link (Task 6 Step 3). Categories `Journal/Press/Exhibitions` match the schema check constraint.

**Placeholder scan:** Editor, form, endpoints, and pages all have complete code. The one instruction-only step (Footer link) names the exact list and markup. The image-upload reuses `/api/upload?kind=posts` (defined in the Artwork CMS plan; the prerequisite note covers the case where that plan hasn't run).

**Type consistency:** `PostRow` (foundation `types.ts`) is the single post shape used by `posts.ts`, `PostForm`, list/edit pages, and public pages. `excerpt`/`readingTime` signatures match their tests and call sites. The hidden field `#body` + `#editor` ids match between `PostForm.astro` and `editor.ts`. `status` values (`draft`/`published`) and the `kind` action values (`status`/`delete`) are consistent across `save.ts`, `action.ts`, and the list page forms.
```
