# VERSO Inquiry Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist "Inquire about this work" and contact-form submissions to the `inquiries` table via a public `POST /api/inquire`, wire the inquiry modal + contact form to it, and give the admin an inbox at `/admin/inquiries` to read and triage them.

**Architecture:** A public, CSRF-exempt endpoint (`/api/inquire`) validates input and inserts via the service-role client (RLS denies anon writes, so the server key is required). The inquiry modal and contact form submit via `fetch`. The admin inbox lists newest-first and updates status via form-POST.

**Tech Stack:** Astro 5 SSR, Supabase (service-role insert), the `inquiries` table from the foundation schema.

**Prerequisite:** Foundation plan complete; `inquiries` table exists; admin auth works. (Independent of the Artwork CMS plan, though inquiries link to artworks when available.)

**Source reference:** doula public form endpoint `C:\Users\wgrif\Projects\TheWildBirthDoulah\src\pages\api\submit.ts`.

---

## File structure

```
src/lib/inquiries.ts             # CREATE: validation + insert helper
src/pages/api/inquire.ts         # CREATE: public POST endpoint
src/components/InquiryModal.astro # MODIFY: real fetch submit
src/pages/contact.astro          # MODIFY: real fetch submit
src/pages/works/[slug].astro     # MODIFY: pass artwork id/title to modal
src/pages/admin/inquiries/index.astro   # CREATE: inbox list
src/pages/admin/inquiries/[id].astro    # CREATE: detail
src/pages/admin/inquiries/status.ts     # CREATE: set status
src/pages/admin/index.astro      # MODIFY: show new-inquiry count
tests/inquiries.test.ts          # CREATE
```

---

## Task 1: Inquiry validation + insert helper

**Files:**
- Create: `src/lib/inquiries.ts`
- Test: `tests/inquiries.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/inquiries.test.ts
import { describe, it, expect } from 'vitest';
import { validateInquiry } from '../src/lib/inquiries';

describe('validateInquiry', () => {
  it('accepts a valid payload', () => {
    const r = validateInquiry({ name: 'A', email: 'a@b.com', message: 'hi', source: 'contact' });
    expect(r.ok).toBe(true);
  });
  it('rejects a missing name', () => {
    const r = validateInquiry({ name: '', email: 'a@b.com', message: 'hi' });
    expect(r.ok).toBe(false);
  });
  it('rejects a bad email', () => {
    const r = validateInquiry({ name: 'A', email: 'nope', message: 'hi' });
    expect(r.ok).toBe(false);
  });
  it('defaults source to contact and clamps long messages', () => {
    const r = validateInquiry({ name: 'A', email: 'a@b.com', message: 'x'.repeat(6000) });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.value.source).toBe('contact'); expect(r.value.message.length).toBe(5000); }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- inquiries`
Expected: FAIL ("Cannot find module '../src/lib/inquiries'").

- [ ] **Step 3: Create `src/lib/inquiries.ts`**

```ts
export interface InquiryInput {
  artwork_id?: string | null;
  artwork_title?: string;
  name: string;
  email: string;
  message: string;
  source?: 'artwork' | 'contact';
}
export type InquiryValid =
  | { ok: true; value: Required<Pick<InquiryInput, 'name' | 'email' | 'message' | 'source'>> & { artwork_id: string | null; artwork_title: string } }
  | { ok: false; error: string };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validateInquiry(input: Partial<InquiryInput>): InquiryValid {
  const name = String(input.name ?? '').trim();
  const email = String(input.email ?? '').trim();
  const message = String(input.message ?? '').trim().slice(0, 5000);
  if (!name) return { ok: false, error: 'Name is required.' };
  if (!EMAIL.test(email)) return { ok: false, error: 'A valid email is required.' };
  const source = input.source === 'artwork' ? 'artwork' : 'contact';
  return {
    ok: true,
    value: {
      name, email, message, source,
      artwork_id: input.artwork_id ? String(input.artwork_id) : null,
      artwork_title: String(input.artwork_title ?? '').slice(0, 300),
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- inquiries`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/inquiries.ts tests/inquiries.test.ts
git commit -m "feat: inquiry validation helper"
```

---

## Task 2: Public `/api/inquire` endpoint

**Files:**
- Create: `src/pages/api/inquire.ts`

- [ ] **Step 1: Create `src/pages/api/inquire.ts`** (no CSRF needed — public submit, no victim cookies; accepts JSON or form data)

```ts
import type { APIRoute } from 'astro';
import { createSupabaseAdmin } from '../../lib/supabase/server';
import { validateInquiry } from '../../lib/inquiries';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let payload: Record<string, unknown> = {};
  const ct = request.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    payload = await request.json().catch(() => ({}));
  } else {
    const f = await request.formData();
    payload = Object.fromEntries(f.entries());
  }

  const v = validateInquiry(payload);
  if (!v.ok) return new Response(JSON.stringify({ error: v.error }), {
    status: 400, headers: { 'content-type': 'application/json' },
  });

  const { error } = await createSupabaseAdmin().from('inquiries').insert(v.value);
  if (error) return new Response(JSON.stringify({ error: 'Could not save inquiry.' }), {
    status: 500, headers: { 'content-type': 'application/json' },
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { 'content-type': 'application/json' },
  });
};
```

- [ ] **Step 2: Build + smoke test the endpoint**

Run: `npm run dev`, then in another terminal:
```bash
curl -s -X POST http://localhost:4321/api/inquire -H 'content-type: application/json' \
  -d '{"name":"Test","email":"t@e.com","message":"hi","source":"contact"}'
```
Expected: `{"ok":true}`; a row appears in Supabase `inquiries`.
Also test invalid: `-d '{"name":"","email":"x"}'` → `{"error":"Name is required."}` with status 400.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/inquire.ts
git commit -m "feat: public inquiry endpoint"
```

---

## Task 3: Wire the inquiry modal to the endpoint

**Files:**
- Modify: `src/components/InquiryModal.astro`, `src/pages/works/[slug].astro`

- [ ] **Step 1: Add hidden artwork fields to the modal form** — in `InquiryModal.astro`, add hidden inputs the page can populate, and a `source`:

Inside the modal `<form>` add:
```html
<input type="hidden" name="artwork_id" id="inqArtworkId" />
<input type="hidden" name="artwork_title" id="inqArtworkTitle" />
<input type="hidden" name="source" id="inqSource" value="contact" />
```

- [ ] **Step 2: Replace the modal submit script** with a real fetch (replacing the thank-you-only fallback from the foundation):

```astro
<script>
  (window as any).openInquiry = (title?: string, id?: string) => {
    const m = document.getElementById('inquireModal')!;
    (m.querySelector('#inqSub') as HTMLElement).textContent =
      title ? 'Regarding: ' + title : 'Tell us what you are looking for.';
    (m.querySelector('#inqArtworkTitle') as HTMLInputElement).value = title ?? '';
    (m.querySelector('#inqArtworkId') as HTMLInputElement).value = id ?? '';
    (m.querySelector('#inqSource') as HTMLInputElement).value = id ? 'artwork' : 'contact';
    m.style.display = 'flex';
  };
  const m = document.getElementById('inquireModal');
  m?.querySelector('#inqClose')?.addEventListener('click', () => { (m as HTMLElement).style.display = 'none'; });
  m?.addEventListener('click', (e) => { if (e.target === m) (m as HTMLElement).style.display = 'none'; });
  m?.querySelector('form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const body = new FormData(form);
    const res = await fetch('/api/inquire', { method: 'POST', body });
    if (res.ok) {
      form.innerHTML = '<p class="lead" style="font-size:1.2rem;">Thank you. Your inquiry has been received — we’ll be in touch shortly.</p>';
    } else {
      const { error } = await res.json().catch(() => ({ error: 'Something went wrong.' }));
      let n = form.querySelector('.inq-err') as HTMLElement;
      if (!n) { n = document.createElement('p'); n.className = 'inq-err muted'; n.style.color = '#c0492f'; form.prepend(n); }
      n.textContent = error;
    }
  });
</script>
```

- [ ] **Step 3: Pass the artwork id/title from the detail page** — in `works/[slug].astro`, the inquire button calls `openInquiry` with the title and the work id:

```html
<button class="btn btn--solid" onclick={`openInquiry(${JSON.stringify(work.title + ' — ' + work.artistName)}, ${JSON.stringify(work.id)})`}>Inquire about this work</button>
```

- [ ] **Step 4: Build + manual test**

Run: `npm run dev`; open a `/works/<slug>`, click Inquire, submit → thank-you; a row with `source='artwork'` and the artwork id appears in `inquiries`.

- [ ] **Step 5: Commit**

```bash
git add src/components/InquiryModal.astro src/pages/works/[slug].astro
git commit -m "feat: wire inquiry modal to persistence"
```

---

## Task 4: Wire the contact form to the endpoint

**Files:**
- Modify: `src/pages/contact.astro`

- [ ] **Step 1: Ensure the contact form has `name`, `email`, `message` fields** and `source=contact`. Add a hidden field if needed:

```html
<input type="hidden" name="source" value="contact" />
```

- [ ] **Step 2: Replace the contact form's client handler** with the fetch pattern:

```astro
<script>
  document.querySelector('form#contactForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const res = await fetch('/api/inquire', { method: 'POST', body: new FormData(form) });
    const target = form.querySelector('.form-status') ?? form;
    if (res.ok) {
      (target as HTMLElement).innerHTML = '<p class="lead">Thank you — your message has been received. We’ll reply within one business day.</p>';
    } else {
      const { error } = await res.json().catch(() => ({ error: 'Something went wrong.' }));
      (target as HTMLElement).innerHTML = `<p class="muted" style="color:#c0492f;">${error}</p>`;
    }
  });
</script>
```

Ensure the contact `<form>` has `id="contactForm"` and contains a `<div class="form-status"></div>` (add if absent).

- [ ] **Step 3: Build + manual test**

Run: `npm run dev`; submit the contact form → thank-you; a row with `source='contact'` appears.

- [ ] **Step 4: Commit**

```bash
git add src/pages/contact.astro
git commit -m "feat: wire contact form to inquiry persistence"
```

---

## Task 5: Admin inbox — list + detail + status

**Files:**
- Create: `src/pages/admin/inquiries/index.astro`, `[id].astro`, `status.ts`

- [ ] **Step 1: Create `src/pages/admin/inquiries/status.ts`**

```ts
import type { APIRoute } from 'astro';
import { createSupabaseServer, createSupabaseAdmin } from '../../../lib/supabase/server';

export const prerender = false;
const STATUSES = new Set(['new', 'replied', 'archived']);

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const auth = createSupabaseServer(cookies, request.headers);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  const f = await request.formData();
  const id = String(f.get('id') ?? '');
  const status = String(f.get('status') ?? '');
  if (id && STATUSES.has(status)) {
    await createSupabaseAdmin().from('inquiries').update({ status }).eq('id', id);
  }
  return redirect(String(f.get('return') ?? '/admin/inquiries'), 303);
};
```

- [ ] **Step 2: Create `src/pages/admin/inquiries/index.astro`** (newest-first, filter by status)

```astro
---
export const prerender = false;
import AdminLayout from '../../../layouts/AdminLayout.astro';
import { createSupabaseAdmin } from '../../../lib/supabase/server';
const filter = Astro.url.searchParams.get('status') ?? 'new';
const q = createSupabaseAdmin().from('inquiries').select('*').order('created_at', { ascending: false });
const { data: rows } = filter === 'all' ? await q : await q.eq('status', filter);
const fmt = (iso: string) => new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
const tabs = ['new', 'replied', 'archived', 'all'];
---
<AdminLayout title="Inquiries">
  <h1 style="font-weight:400;">Inquiries</h1>
  <div style="display:flex;gap:.75rem;margin:.5rem 0 1rem;">
    {tabs.map((t) => <a href={`/admin/inquiries?status=${t}`} style={`color:${t === filter ? '#fff' : '#cfc9b8'};text-transform:capitalize;`}>{t}</a>)}
  </div>
  <div class="admin-card" style="padding:.4rem 1rem;">
    <table class="admin-table">
      <thead><tr><th>Received</th><th>Name</th><th>Regarding</th><th>Status</th><th></th></tr></thead>
      <tbody>
        {(rows ?? []).map((r) => (
          <tr>
            <td style="color:#cfc9b8;white-space:nowrap;">{fmt(r.created_at)}</td>
            <td><a href={`/admin/inquiries/${r.id}`} style="color:#e9e6dc;">{r.name}</a></td>
            <td style="color:#cfc9b8;">{r.artwork_title || (r.source === 'contact' ? 'General contact' : '—')}</td>
            <td style="color:#cfc9b8;text-transform:capitalize;">{r.status}</td>
            <td><a href={`/admin/inquiries/${r.id}`} style="color:#cfc9b8;">Open →</a></td>
          </tr>
        ))}
      </tbody>
    </table>
    {(rows ?? []).length === 0 && <p style="padding:1rem .4rem;color:#8a8675;">No inquiries in “{filter}”.</p>}
  </div>
</AdminLayout>
```

- [ ] **Step 3: Create `src/pages/admin/inquiries/[id].astro`** (detail + status controls + mailto reply)

```astro
---
export const prerender = false;
import AdminLayout from '../../../layouts/AdminLayout.astro';
import { createSupabaseAdmin } from '../../../lib/supabase/server';
const { id } = Astro.params;
const { data: r } = await createSupabaseAdmin().from('inquiries').select('*').eq('id', id).maybeSingle();
if (!r) return Astro.redirect('/admin/inquiries', 303);
const fmt = (iso: string) => new Date(iso).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
const mailto = `mailto:${r.email}?subject=${encodeURIComponent('Re: ' + (r.artwork_title || 'Your inquiry to VERSO'))}`;
---
<AdminLayout title={`Inquiry from ${r.name}`}>
  <p><a href="/admin/inquiries" style="color:#cfc9b8;">← All inquiries</a></p>
  <div class="admin-card" style="max-width:680px;">
    <h1 style="font-weight:400;margin-top:0;">{r.name}</h1>
    <p style="color:#cfc9b8;">{fmt(r.created_at)} · <span style="text-transform:capitalize;">{r.status}</span></p>
    <p><strong>Email:</strong> <a href={mailto} style="color:#e9e6dc;">{r.email}</a></p>
    {r.artwork_title && <p><strong>Regarding:</strong> {r.artwork_title}</p>}
    <p><strong>Message:</strong></p>
    <p style="white-space:pre-wrap;color:#e9e6dc;">{r.message || '(no message)'}</p>
    <div style="display:flex;gap:.5rem;margin-top:1.2rem;flex-wrap:wrap;">
      <a class="admin-btn" href={mailto}>Reply by email</a>
      {['new', 'replied', 'archived'].map((s) => (
        <form method="POST" action="/admin/inquiries/status">
          <input type="hidden" name="id" value={r.id} />
          <input type="hidden" name="status" value={s} />
          <input type="hidden" name="return" value={`/admin/inquiries/${r.id}`} />
          <button class="admin-btn" style="background:#2c2a20;" type="submit" disabled={r.status === s}>Mark {s}</button>
        </form>
      ))}
    </div>
  </div>
</AdminLayout>
```

- [ ] **Step 4: Build + manual test**

Run: `npm run dev`
- Submit an inquiry from the public site → appears under `/admin/inquiries` (New tab).
- Open detail, "Mark replied" → moves to Replied tab. "Reply by email" opens mail client.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/inquiries
git commit -m "feat: admin inquiry inbox with status triage"
```

---

## Task 6: New-inquiry count on the dashboard

**Files:**
- Modify: `src/pages/admin/index.astro`

- [ ] **Step 1: Add a count query + link** in `admin/index.astro` frontmatter:

```ts
import { createSupabaseAdmin } from '../../lib/supabase/server';
const { count } = await createSupabaseAdmin()
  .from('inquiries').select('*', { count: 'exact', head: true }).eq('status', 'new');
```

In the body:
```astro
<p><a href="/admin/inquiries" style="color:#e9e6dc;">{count ?? 0} new inquiry{(count ?? 0) === 1 ? '' : 's'}</a> awaiting reply.</p>
```

- [ ] **Step 2: Build + verify** the count reflects unreplied inquiries.

Run: `npm run build && npm run preview`

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/index.astro
git commit -m "feat: surface new-inquiry count on admin dashboard"
```

---

## Self-review (completed during authoring)

**Spec coverage:** Public capture from both the artwork modal (Task 3) and contact form (Task 4) → `/api/inquire` (Task 2) → `inquiries` table; admin inbox with read + status triage (Task 5) and dashboard surfacing (Task 6). Replaces the foundation's fake thank-you fallback.

**Placeholder scan:** No vague steps. The endpoint handles both JSON and form encodings explicitly. Validation is real code with tests.

**Type consistency:** `validateInquiry` output keys (`name`, `email`, `message`, `source`, `artwork_id`, `artwork_title`) match the `inquiries` columns in `schema.sql` and the insert in `/api/inquire`. `openInquiry(title, id)` signature matches the modal script (Task 3) and the detail-page call (Task 3 Step 3). Status values (`new`/`replied`/`archived`) match the schema check constraint and the `status.ts` allow-set.
