# Inquiry Inbox + Lead Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture every public inquiry (today the modal silently discards them) into Supabase and give the superadmin an inbox to work leads through a lean pipeline.

**Architecture:** Pure, unit-tested domain logic in `src/lib/inquiries.ts` (validation, honeypot, rate-limit, mapper, status enum); a thin public `POST /api/inquire` endpoint that uses it + a dormant Resend email adapter; admin inbox pages following the existing `admin/artworks` list/detail/save/action pattern (service-role writes, auth-checked). Reuses `AdminLayout`, `admin.css`, and the Supabase server module.

**Tech Stack:** Astro 5 (SSR, `prerender=false`), Supabase (`@supabase/supabase-js` service-role client), Vitest (colocated `*.test.ts`), optional Resend (transactional email, env-gated).

**Spec:** [Phase 1 — Inquiry Inbox design](../specs/2026-06-19-inquiry-inbox-design.md)

---

## Prerequisites (one-time, by the human operator)

- **Run the DB migration** added in Task 2 in the Supabase SQL editor (extends `inquiries`).
- **Email is optional:** the inbox works with no email provider. To enable alerts later, set `RESEND_API_KEY` (and verify a sending domain) — the adapter stays dormant until then.
- Local verification needs `npm run dev` plus Supabase env (`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) for the insert/read to actually persist.

## File map

| File | Responsibility |
|---|---|
| `src/lib/inquiries.ts` *(create)* | Domain: `Inquiry` type, statuses, `validateInquiry`, `isHoneypotTripped`, `isRateLimited`, `rowToInquiry`, `isValidStatus` |
| `src/lib/inquiries.test.ts` *(create)* | Unit tests for the above |
| `src/lib/email.ts` *(create)* | Dormant Resend adapter: `emailConfigured`, `notifyNewInquiry`, `sendAutoresponder` |
| `src/lib/email.test.ts` *(create)* | Asserts no-op when no key |
| `src/lib/supabase/types.ts` *(modify)* | Extend `InquiryRow` |
| `supabase/schema.sql` *(modify)* | Idempotent migration for the new columns + status enum |
| `src/pages/api/inquire.ts` *(create)* | Public capture endpoint |
| `src/components/InquiryModal.astro` *(modify)* | Honeypot + consent + real submit; `openInquiry(title, artworkId)` |
| `src/pages/works/[slug].astro` *(modify)* | Pass `work.id` to `openInquiry` |
| `src/pages/admin/inquiries/index.astro` *(create)* | Inbox list (filter, badges, bulk, empty state) |
| `src/pages/admin/inquiries/[id].astro` *(create)* | Detail (status, notes, mailto reply, delete) |
| `src/pages/admin/inquiries/save.ts` *(create)* | Update status + notes |
| `src/pages/admin/inquiries/action.ts` *(create)* | Bulk status / delete |
| `src/styles/admin.css` *(modify)* | Status-badge + table + help styles |
| `src/layouts/AdminLayout.astro` *(modify)* | Remove dead `Viewing Rooms` nav link |
| `docs/admin-guide/inquiries.md` *(create)* | Written superadmin guide section |
| `scripts/e2e-inquiry.mjs` *(create, optional)* | Public submit e2e (Playwright lib, needs dev server + Supabase) |

---

### Task 1: Inquiry domain module (TDD)

**Files:**
- Create: `src/lib/inquiries.ts`
- Test: `src/lib/inquiries.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/inquiries.test.ts
import { describe, it, expect } from 'vitest';
import {
  validateInquiry, isHoneypotTripped, isRateLimited, rowToInquiry,
  isValidStatus, INQUIRY_STATUSES, RATE_LIMIT_MAX,
} from './inquiries';
import type { InquiryRow } from './supabase/types';

describe('validateInquiry', () => {
  it('accepts a complete inquiry and trims fields', () => {
    const r = validateInquiry({ name: ' Ada ', email: 'ada@x.com', message: ' hi ' });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.value.name).toBe('Ada'); expect(r.value.message).toBe('hi'); }
  });
  it('rejects a missing name', () => {
    const r = validateInquiry({ name: '', email: 'a@b.com', message: 'hi' });
    expect(r).toMatchObject({ ok: false, field: 'name' });
  });
  it('rejects a bad email', () => {
    const r = validateInquiry({ name: 'Ada', email: 'nope', message: 'hi' });
    expect(r).toMatchObject({ ok: false, field: 'email' });
  });
  it('rejects a missing message', () => {
    const r = validateInquiry({ name: 'Ada', email: 'a@b.com', message: '   ' });
    expect(r).toMatchObject({ ok: false, field: 'message' });
  });
});

describe('isHoneypotTripped', () => {
  it('is true when the honeypot is filled', () => {
    expect(isHoneypotTripped({ honeypot: 'bot' })).toBe(true);
  });
  it('is false when empty', () => {
    expect(isHoneypotTripped({ honeypot: '' })).toBe(false);
    expect(isHoneypotTripped({})).toBe(false);
  });
});

describe('isRateLimited', () => {
  it('blocks at or above the max', () => {
    expect(isRateLimited(RATE_LIMIT_MAX)).toBe(true);
    expect(isRateLimited(RATE_LIMIT_MAX - 1)).toBe(false);
  });
});

describe('isValidStatus', () => {
  it('accepts pipeline statuses and rejects junk', () => {
    expect(INQUIRY_STATUSES.every(isValidStatus)).toBe(true);
    expect(isValidStatus('replied')).toBe(false);
  });
});

describe('rowToInquiry', () => {
  it('maps a row to the domain object with safe defaults', () => {
    const row: InquiryRow = {
      id: 'i1', artwork_id: 'w1', artwork_title: 'Blue', name: 'Ada', email: 'a@b.com',
      phone: '', message: 'hi', status: 'new', source: 'artwork',
      internal_notes: '', consent_marketing: false, consent_ts: null,
      status_changed_at: null, ip: null, created_at: '2026-06-19T00:00:00Z',
    };
    const inq = rowToInquiry(row);
    expect(inq.artworkId).toBe('w1');
    expect(inq.status).toBe('new');
    expect(inq.consentMarketing).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/inquiries.test.ts`
Expected: FAIL — cannot resolve `./inquiries` (module not created yet).

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/inquiries.ts
import type { InquiryRow } from './supabase/types';

export const INQUIRY_STATUSES = ['new', 'contacted', 'won', 'lost', 'archived'] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const INQUIRY_SOURCES = ['artwork', 'contact'] as const;
export type InquirySource = (typeof INQUIRY_SOURCES)[number];

/** Best-effort, serverless-safe rate-limit: max inserts per IP per window. */
export const RATE_LIMIT_MAX = 5;
export const RATE_LIMIT_WINDOW_MS = 60_000;

export interface Inquiry {
  id: string;
  artworkId: string | null;
  artworkTitle: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  status: InquiryStatus;
  source: InquirySource;
  internalNotes: string;
  consentMarketing: boolean;
  createdAt: string;
  statusChangedAt: string | null;
}

export function rowToInquiry(r: InquiryRow): Inquiry {
  return {
    id: r.id,
    artworkId: r.artwork_id,
    artworkTitle: r.artwork_title ?? '',
    name: r.name,
    email: r.email,
    phone: r.phone ?? '',
    message: r.message ?? '',
    status: r.status,
    source: r.source,
    internalNotes: r.internal_notes ?? '',
    consentMarketing: r.consent_marketing ?? false,
    createdAt: r.created_at,
    statusChangedAt: r.status_changed_at ?? null,
  };
}

export interface InquiryInput {
  name?: string; email?: string; message?: string;
  phone?: string; consent?: boolean;
  artworkId?: string | null; artworkTitle?: string;
  source?: InquirySource; honeypot?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isHoneypotTripped(input: { honeypot?: string }): boolean {
  return Boolean(input.honeypot && input.honeypot.trim() !== '');
}

export type ValidationResult =
  | { ok: true; value: InquiryInput & { name: string; email: string; message: string } }
  | { ok: false; field: 'name' | 'email' | 'message'; error: string };

export function validateInquiry(input: InquiryInput): ValidationResult {
  const name = (input.name ?? '').trim();
  const email = (input.email ?? '').trim();
  const message = (input.message ?? '').trim();
  if (!name) return { ok: false, field: 'name', error: 'Please enter your name.' };
  if (name.length > 200) return { ok: false, field: 'name', error: 'Name is too long.' };
  if (!EMAIL_RE.test(email)) return { ok: false, field: 'email', error: 'Please enter a valid email.' };
  if (!message) return { ok: false, field: 'message', error: 'Please enter a message.' };
  if (message.length > 5000) return { ok: false, field: 'message', error: 'Message is too long.' };
  return { ok: true, value: { ...input, name, email, message } };
}

export function isRateLimited(recentCount: number): boolean {
  return recentCount >= RATE_LIMIT_MAX;
}

export function isValidStatus(s: string): s is InquiryStatus {
  return (INQUIRY_STATUSES as readonly string[]).includes(s);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/inquiries.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/inquiries.ts src/lib/inquiries.test.ts
git commit -m "feat(inquiries): domain module — validation, honeypot, rate-limit, mapper (TDD)"
```

---

### Task 2: Extend `InquiryRow` + DB migration

**Files:**
- Modify: `src/lib/supabase/types.ts` (the `InquiryRow` line)
- Modify: `supabase/schema.sql` (append migration)

- [ ] **Step 1: Update the row type**

Replace the existing `InquiryRow` interface with:

```ts
export interface InquiryRow {
  id: string; artwork_id: string | null; artwork_title: string;
  name: string; email: string; phone: string; message: string;
  status: 'new' | 'contacted' | 'won' | 'lost' | 'archived';
  source: 'artwork' | 'contact';
  internal_notes: string; consent_marketing: boolean; consent_ts: string | null;
  status_changed_at: string | null; ip: string | null; created_at: string;
}
```

- [ ] **Step 2: Append the idempotent migration to `supabase/schema.sql`**

Add at the end of the file:

```sql
-- ===== inquiries: lead-pipeline extension (Phase 1, 2026-06-19) =====
alter table public.inquiries add column if not exists phone text not null default '';
alter table public.inquiries add column if not exists consent_marketing boolean not null default false;
alter table public.inquiries add column if not exists consent_ts timestamptz;
alter table public.inquiries add column if not exists internal_notes text not null default '';
alter table public.inquiries add column if not exists status_changed_at timestamptz;
alter table public.inquiries add column if not exists ip text;

-- migrate the status enum: new,replied,archived -> new,contacted,won,lost,archived
update public.inquiries set status = 'contacted' where status = 'replied';
alter table public.inquiries drop constraint if exists inquiries_status_check;
alter table public.inquiries add constraint inquiries_status_check
  check (status in ('new','contacted','won','lost','archived'));

create index if not exists inquiries_ip_created_idx on public.inquiries (ip, created_at);
create index if not exists inquiries_status_created_idx on public.inquiries (status, created_at desc);
```

- [ ] **Step 3: Verify the type change compiles**

Run: `npm run build`
Expected: `Complete!` with no TypeScript errors. (The `inquiries.test.ts` row in Task 1 already references the new fields; a clean build confirms type alignment.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/types.ts supabase/schema.sql
git commit -m "feat(inquiries): extend InquiryRow + idempotent DB migration (lean pipeline)"
```

> **Operator action:** run the appended SQL in the Supabase SQL editor before testing capture.

---

### Task 3: Dormant Resend email adapter (TDD)

**Files:**
- Create: `src/lib/email.ts`
- Test: `src/lib/email.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/email.test.ts
import { describe, it, expect } from 'vitest';
import { emailConfigured, notifyNewInquiry, sendAutoresponder } from './email';
import type { Inquiry } from './inquiries';

const inq: Inquiry = {
  id: 'i1', artworkId: null, artworkTitle: '', name: 'Ada', email: 'a@b.com',
  phone: '', message: 'hi', status: 'new', source: 'contact',
  internalNotes: '', consentMarketing: false, createdAt: '', statusChangedAt: null,
};

describe('email adapter (no key in test env)', () => {
  it('reports not configured', () => { expect(emailConfigured()).toBe(false); });
  it('no-ops without throwing or sending', async () => {
    await expect(notifyNewInquiry(inq, 'http://localhost')).resolves.toBe(false);
    await expect(sendAutoresponder(inq)).resolves.toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/email.test.ts`
Expected: FAIL — cannot resolve `./email`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/email.ts
import { BRAND } from './site';
import type { Inquiry } from './inquiries';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
// Sending address — requires a domain verified in Resend before email goes live.
const FROM = 'Mazlish + Wright <noreply@mazlishwrightcontemporary.com>';

function resendKey(): string {
  const fromBuild = (import.meta.env as Record<string, string | undefined>)['RESEND_API_KEY'];
  const fromRuntime =
    typeof process !== 'undefined' && process.env ? process.env.RESEND_API_KEY : undefined;
  return fromBuild ?? fromRuntime ?? '';
}

export function emailConfigured(): boolean {
  return Boolean(resendKey());
}

async function send(payload: { to: string[]; subject: string; text: string }): Promise<boolean> {
  const key = resendKey();
  if (!key) return false; // dormant
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, ...payload }),
    });
    return res.ok;
  } catch {
    return false; // never let a provider outage break capture
  }
}

export async function notifyNewInquiry(inq: Inquiry, baseUrl: string): Promise<boolean> {
  const contact = `${inq.name} <${inq.email}>${inq.phone ? ' · ' + inq.phone : ''}`;
  return send({
    to: [BRAND.email],
    subject: `New inquiry — ${inq.artworkTitle || inq.name}`,
    text: `${contact}\nWork: ${inq.artworkTitle || '—'}\n\n${inq.message}\n\nManage: ${baseUrl}/admin/inquiries/${inq.id}`,
  });
}

export async function sendAutoresponder(inq: Inquiry): Promise<boolean> {
  return send({
    to: [inq.email],
    subject: 'We received your inquiry — Mazlish + Wright Contemporary',
    text: `Dear ${inq.name},\n\nThank you for your inquiry${inq.artworkTitle ? ` regarding ${inq.artworkTitle}` : ''}. A gallery representative will reply within one business day.\n\nMazlish + Wright Contemporary`,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/email.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/email.ts src/lib/email.test.ts
git commit -m "feat(inquiries): dormant Resend email adapter (env-gated, no-op without key)"
```

---

### Task 4: Public capture endpoint `POST /api/inquire`

**Files:**
- Create: `src/pages/api/inquire.ts`

- [ ] **Step 1: Write the endpoint**

```ts
// src/pages/api/inquire.ts
import type { APIRoute } from 'astro';
import { createSupabaseAdmin } from '../../lib/supabase/server';
import {
  validateInquiry, isHoneypotTripped, isRateLimited, rowToInquiry,
  RATE_LIMIT_WINDOW_MS, type InquirySource,
} from '../../lib/inquiries';
import { notifyNewInquiry, sendAutoresponder } from '../../lib/email';

export const prerender = false;

function clientIp(headers: Headers): string {
  return (headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
}

export const POST: APIRoute = async ({ request }) => {
  // Accept JSON (fetch) or form-encoded (no-JS fallback).
  let body: Record<string, string> = {};
  const ct = request.headers.get('content-type') ?? '';
  try {
    if (ct.includes('application/json')) {
      body = await request.json();
    } else {
      const f = await request.formData();
      body = Object.fromEntries([...f.entries()].map(([k, v]) => [k, String(v)]));
    }
  } catch {
    return Response.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
  }

  // Honeypot: respond success but store nothing (give bots no signal).
  if (isHoneypotTripped({ honeypot: body.company })) {
    return Response.json({ ok: true });
  }

  const consent = body.consent === 'on' || body.consent === 'true';
  const v = validateInquiry({
    name: body.name, email: body.email, message: body.message, phone: body.phone,
    consent,
    artworkId: body.artwork_id || null,
    artworkTitle: body.artwork_title || '',
    source: (body.source === 'artwork' ? 'artwork' : 'contact') as InquirySource,
  });
  if (!v.ok) return Response.json({ ok: false, field: v.field, error: v.error }, { status: 400 });

  const admin = createSupabaseAdmin();
  const ip = clientIp(request.headers);

  // Best-effort rate-limit: count this IP's inserts in the window.
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count } = await admin
    .from('inquiries')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .gte('created_at', since);
  if (isRateLimited(count ?? 0)) {
    return Response.json({ ok: false, error: 'Too many requests — please try again shortly.' }, { status: 429 });
  }

  const { data, error } = await admin
    .from('inquiries')
    .insert({
      artwork_id: v.value.artworkId ?? null,
      artwork_title: v.value.artworkTitle ?? '',
      name: v.value.name,
      email: v.value.email,
      phone: v.value.phone ?? '',
      message: v.value.message,
      source: v.value.source ?? 'contact',
      consent_marketing: consent,
      consent_ts: consent ? new Date().toISOString() : null,
      ip,
    })
    .select('*')
    .single();

  if (error || !data) {
    return Response.json({ ok: false, error: 'Could not submit — please try again.' }, { status: 500 });
  }

  // Notifications are dormant unless RESEND_API_KEY is set; never block the response.
  const inquiry = rowToInquiry(data);
  const origin = new URL(request.url).origin;
  try {
    await Promise.allSettled([notifyNewInquiry(inquiry, origin), sendAutoresponder(inquiry)]);
  } catch { /* ignore */ }

  return Response.json({ ok: true });
};
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: `Complete!` — endpoint compiles, imports resolve.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/inquire.ts
git commit -m "feat(inquiries): public POST /api/inquire (validate, honeypot, rate-limit, store, notify)"
```

---

### Task 5: Wire the public modal + per-artwork button

**Files:**
- Modify: `src/components/InquiryModal.astro` (form + script)
- Modify: `src/pages/works/[slug].astro:80` (pass `work.id`)

- [ ] **Step 1: Replace the `<form id="inquireForm">` block** in `InquiryModal.astro` with:

```html
    <form id="inquireForm">
      <div class="form-grid">
        <div class="field"><label>Name</label><input name="name" required /></div>
        <div class="field"><label>Email</label><input type="email" name="email" required /></div>
        <div class="field full"><label>Phone (optional)</label><input name="phone" /></div>
        <div class="field full"><label>Message</label><textarea name="message" rows="3" placeholder="I'd like to learn more about this work, including availability."></textarea></div>
      </div>
      <input type="hidden" name="artwork_id" id="inqArtworkId" />
      <input type="hidden" name="artwork_title" id="inqArtworkTitle" />
      <input type="hidden" name="source" id="inqSource" value="contact" />
      <div aria-hidden="true" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;">
        <label>Company<input name="company" tabindex="-1" autocomplete="off" /></label>
      </div>
      <label style="display:flex;gap:.5rem;align-items:flex-start;font-size:.78rem;margin-top:.8rem;">
        <input type="checkbox" name="consent" style="width:auto;margin-top:.15rem;" />
        <span>Keep me informed about new works and exhibitions.</span>
      </label>
      <p id="inqError" class="muted" style="display:none;color:#8a2b1f;margin-top:.6rem;"></p>
      <button class="btn btn--solid mt-2" type="submit" style="width:100%;justify-content:center;">Send inquiry</button>
      <p class="muted" style="font-size:.74rem;margin-top:1rem;">A gallery representative typically replies within one business day.</p>
    </form>
```

- [ ] **Step 2: Replace the `openInquiry` definition** (the `(window as any).openInquiry = (title?: string) => { ... }` block) with:

```js
  (window as any).openInquiry = (title?: string, artworkId?: string) => {
    if (!modal) return;
    const sub = modal.querySelector('#inqSub') as HTMLElement | null;
    if (sub) sub.textContent = title ? 'Regarding: ' + title : 'Tell us what you are looking for.';
    (modal.querySelector('#inqArtworkTitle') as HTMLInputElement).value = title ?? '';
    (modal.querySelector('#inqArtworkId') as HTMLInputElement).value = artworkId ?? '';
    (modal.querySelector('#inqSource') as HTMLInputElement).value = artworkId ? 'artwork' : 'contact';
    (modal as HTMLElement).style.display = 'flex';
  };
```

- [ ] **Step 3: Replace the form `submit` handler** (the `addEventListener('submit', (e) => { ... })` block that swaps innerHTML to a thank-you) with:

```js
  modal?.querySelector('#inquireForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const err = form.querySelector('#inqError') as HTMLElement;
    const btn = form.querySelector('button[type=submit]') as HTMLButtonElement;
    err.style.display = 'none';
    btn.disabled = true;
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      const res = await fetch('/api/inquire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        form.innerHTML =
          '<p class="lead" style="font-size:1.2rem;">Thank you. Your inquiry has been received — we’ll be in touch shortly.</p>';
      } else {
        err.textContent = data.error || 'Please check your details and try again.';
        err.style.display = 'block';
        btn.disabled = false;
      }
    } catch {
      err.textContent = 'Network error — please try again.';
      err.style.display = 'block';
      btn.disabled = false;
    }
  });
```

- [ ] **Step 4: Pass the artwork id** — in `src/pages/works/[slug].astro:80`, replace the Inquire button's `onclick` with:

```astro
          <button class="btn btn--solid" style="width:100%;justify-content:center;" onclick={`openInquiry('${(work.title + ' — ' + work.artistName).replace(/'/g, "\\'")}', '${work.id}')`}>Inquire about this work</button>
```

- [ ] **Step 5: Verify in preview**

Start the dev server, open a work page, click "Inquire about this work", fill name/email/message, submit.
Expected: the form swaps to the thank-you message; `preview_network` shows `POST /api/inquire` → 200 `{ok:true}`; with Supabase configured, a row exists (verified in Task 6's inbox).

- [ ] **Step 6: Commit**

```bash
git add src/components/InquiryModal.astro src/pages/works/[slug].astro
git commit -m "feat(inquiries): wire modal to /api/inquire (honeypot, consent, per-artwork context)"
```

---

### Task 6: Admin inbox (list, detail, handlers, badges, nav cleanup)

**Files:**
- Create: `src/pages/admin/inquiries/index.astro`
- Create: `src/pages/admin/inquiries/[id].astro`
- Create: `src/pages/admin/inquiries/save.ts`
- Create: `src/pages/admin/inquiries/action.ts`
- Modify: `src/styles/admin.css` (append badge/table/help styles)
- Modify: `src/layouts/AdminLayout.astro` (remove dead Viewing Rooms link)

- [ ] **Step 1: List page**

```astro
---
// src/pages/admin/inquiries/index.astro
export const prerender = false;
import AdminLayout from '../../../layouts/AdminLayout.astro';
import { createSupabaseAdmin } from '../../../lib/supabase/server';
import { rowToInquiry, INQUIRY_STATUSES } from '../../../lib/inquiries';

const url = Astro.url;
const statusFilter = url.searchParams.get('status') ?? '';
const sourceFilter = url.searchParams.get('source') ?? '';

let q = createSupabaseAdmin().from('inquiries').select('*').order('created_at', { ascending: false });
if (statusFilter) q = q.eq('status', statusFilter);
if (sourceFilter) q = q.eq('source', sourceFilter);
const { data: rows } = await q;
const inquiries = (rows ?? []).map(rowToInquiry);
const newCount = inquiries.filter((i) => i.status === 'new').length;
const flash = url.searchParams.get('saved') ? 'Saved.'
  : url.searchParams.get('deleted') ? 'Deleted.'
  : url.searchParams.get('updated') ? 'Updated.' : '';
---
<AdminLayout title="Inquiries">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
    <h1 style="font-weight:400;">Inquiries {newCount ? <span class="badge badge--new">{newCount} new</span> : null}</h1>
    <details class="admin-help"><summary>How inquiries work</summary>
      <p>Every submission from the public “Inquire” buttons lands here. Open one to read it, change its
      status as you work the lead, and use <strong>Reply by email</strong> to answer from your mail app.
      To get an email alert the moment one arrives, add a Resend API key (see the admin guide).</p>
    </details>
  </div>
  {flash && <p class="admin-status">{flash}</p>}

  <form method="get" class="admin-filter" style="display:flex;gap:.6rem;margin:1rem 0;flex-wrap:wrap;">
    <select name="status" onchange="this.form.submit()">
      <option value="">All statuses</option>
      {INQUIRY_STATUSES.map((s) => <option value={s} selected={statusFilter === s}>{s}</option>)}
    </select>
    <select name="source" onchange="this.form.submit()">
      <option value="">All sources</option>
      <option value="artwork" selected={sourceFilter === 'artwork'}>artwork</option>
      <option value="contact" selected={sourceFilter === 'contact'}>contact</option>
    </select>
    <noscript><button class="admin-btn" type="submit">Filter</button></noscript>
  </form>

  {inquiries.length === 0 ? (
    <p class="admin-empty">No inquiries yet — your public Inquire form feeds this inbox.</p>
  ) : (
    <form method="POST" action="/admin/inquiries/action">
      <div class="admin-bulkbar">
        <button class="admin-btn" name="bulk" value="contacted" type="submit">Mark contacted</button>
        <button class="admin-btn" name="bulk" value="archived" type="submit">Archive</button>
      </div>
      <table class="admin-table">
        <thead><tr><th></th><th>Date</th><th>Name</th><th>Work</th><th>Source</th><th>Status</th><th>Message</th></tr></thead>
        <tbody>
          {inquiries.map((i) => (
            <tr>
              <td><input type="checkbox" name="ids" value={i.id} /></td>
              <td style="white-space:nowrap;">{new Date(i.createdAt).toLocaleDateString()}</td>
              <td><a href={`/admin/inquiries/${i.id}`}>{i.name}</a></td>
              <td>{i.artworkTitle || '—'}</td>
              <td>{i.source}</td>
              <td><span class={`badge badge--${i.status}`}>{i.status}</span></td>
              <td style="color:#6b6860;">{i.message.slice(0, 60)}{i.message.length > 60 ? '…' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </form>
  )}
</AdminLayout>
```

- [ ] **Step 2: Detail page**

```astro
---
// src/pages/admin/inquiries/[id].astro
export const prerender = false;
import AdminLayout from '../../../layouts/AdminLayout.astro';
import { createSupabaseAdmin } from '../../../lib/supabase/server';
import { rowToInquiry, INQUIRY_STATUSES } from '../../../lib/inquiries';

const { id } = Astro.params;
const { data: row } = await createSupabaseAdmin().from('inquiries').select('*').eq('id', id).maybeSingle();
if (!row) return Astro.redirect('/admin/inquiries', 303);
const inq = rowToInquiry(row);
const subject = 'Re: your inquiry' + (inq.artworkTitle ? ' — ' + inq.artworkTitle : '');
const mailto = `mailto:${inq.email}?subject=${encodeURIComponent(subject)}`;
---
<AdminLayout title={`Inquiry — ${inq.name}`}>
  <p><a href="/admin/inquiries">← All inquiries</a></p>
  <h1 style="font-weight:400;">{inq.name} <span class={`badge badge--${inq.status}`}>{inq.status}</span></h1>
  <p style="color:#6b6860;">{new Date(inq.createdAt).toLocaleString()} · source: {inq.source}</p>

  <section class="admin-card" style="max-width:640px;">
    <p><strong>Email:</strong> <a href={mailto}>{inq.email}</a></p>
    {inq.phone && <p><strong>Phone:</strong> {inq.phone}</p>}
    <p><strong>Work:</strong> {inq.artworkTitle || '—'}</p>
    <p><strong>Marketing consent:</strong> {inq.consentMarketing ? 'Yes' : 'No'}</p>
    <p style="margin-bottom:.2rem;"><strong>Message</strong></p>
    <p style="white-space:pre-wrap;margin-top:0;">{inq.message}</p>
    <a class="admin-btn" href={mailto}>Reply by email →</a>
  </section>

  <form method="POST" action="/admin/inquiries/save" class="admin-card" style="max-width:640px;margin-top:1.5rem;">
    <input type="hidden" name="id" value={inq.id} />
    <div class="admin-field"><label>Status</label>
      <select name="status">
        {INQUIRY_STATUSES.map((s) => <option value={s} selected={inq.status === s}>{s}</option>)}
      </select>
    </div>
    <div class="admin-field"><label>Internal notes</label><textarea name="internal_notes" rows="4">{inq.internalNotes}</textarea></div>
    <button class="admin-btn" type="submit">Save</button>
  </form>

  <form method="POST" action="/admin/inquiries/action" style="margin-top:.6rem;" onsubmit="return confirm('Delete this inquiry?')">
    <input type="hidden" name="ids" value={inq.id} />
    <input type="hidden" name="bulk" value="delete" />
    <button class="admin-btn danger" type="submit">Delete</button>
  </form>
</AdminLayout>
```

- [ ] **Step 3: Save handler**

```ts
// src/pages/admin/inquiries/save.ts
import type { APIRoute } from 'astro';
import { createSupabaseServer, createSupabaseAdmin } from '../../../lib/supabase/server';
import { isValidStatus } from '../../../lib/inquiries';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const auth = createSupabaseServer(cookies, request.headers);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const f = await request.formData();
  const id = String(f.get('id') ?? '');
  if (!id) return new Response('Missing id', { status: 400 });

  const fields: Record<string, unknown> = { internal_notes: String(f.get('internal_notes') ?? '') };
  const status = String(f.get('status') ?? '');
  if (isValidStatus(status)) {
    fields.status = status;
    fields.status_changed_at = new Date().toISOString();
  }
  await createSupabaseAdmin().from('inquiries').update(fields).eq('id', id);
  return redirect(`/admin/inquiries/${id}?saved=1`, 303);
};
```

- [ ] **Step 4: Action handler (bulk status + delete)**

```ts
// src/pages/admin/inquiries/action.ts
import type { APIRoute } from 'astro';
import { createSupabaseServer, createSupabaseAdmin } from '../../../lib/supabase/server';
import { isValidStatus } from '../../../lib/inquiries';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const auth = createSupabaseServer(cookies, request.headers);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const f = await request.formData();
  const ids = f.getAll('ids').map(String).filter(Boolean);
  const bulk = String(f.get('bulk') ?? '');
  if (ids.length === 0) return redirect('/admin/inquiries', 303);

  const admin = createSupabaseAdmin();
  if (bulk === 'delete') {
    await admin.from('inquiries').delete().in('id', ids);
    return redirect('/admin/inquiries?deleted=1', 303);
  }
  if (isValidStatus(bulk)) {
    await admin.from('inquiries').update({ status: bulk, status_changed_at: new Date().toISOString() }).in('id', ids);
    return redirect('/admin/inquiries?updated=1', 303);
  }
  return redirect('/admin/inquiries', 303);
};
```

- [ ] **Step 5: Append admin styles** to `src/styles/admin.css`

```css
/* ===== Inquiry inbox / shared list-UX kit ===== */
.badge { display:inline-block; padding:.12rem .55rem; border-radius:999px; font-size:.68rem;
  letter-spacing:.05em; text-transform:uppercase; border:1px solid currentColor; }
.badge--new { color:#8a2b1f; }
.badge--contacted { color:#5b6470; }
.badge--won { color:#3f6b4f; }
.badge--lost { color:#9a9a9a; }
.badge--archived { color:#b0aca2; }
.admin-table { width:100%; border-collapse:collapse; font-size:.9rem; }
.admin-table th { text-align:left; color:#8a8675; font-weight:500; font-size:.72rem;
  text-transform:uppercase; letter-spacing:.06em; padding:.4rem .6rem; }
.admin-table td { text-align:left; padding:.5rem .6rem; border-top:1px solid var(--mw-line,#e4e2db); vertical-align:top; }
.admin-empty { color:#6b6860; padding:2rem 0; }
.admin-bulkbar { display:flex; gap:.5rem; margin:.5rem 0; }
.admin-filter select { padding:.4rem .6rem; }
.admin-help summary { cursor:pointer; color:#6b6860; font-size:.82rem; }
.admin-help[open] { background:var(--mw-line-soft,#f4f2ec); padding:.6rem .85rem; border-radius:6px; max-width:540px; margin-top:.4rem; }
```

- [ ] **Step 6: Remove the dead nav link** — in `src/layouts/AdminLayout.astro`, delete the line:

```astro
  { href: '/admin/viewing-rooms', label: 'Viewing Rooms' },
```

(Viewing rooms are out of scope; the route will never exist. Leave `Exhibitions` and `Press` — they ship in later phases.)

- [ ] **Step 7: Verify build + preview**

Run: `npm run build` → Expected `Complete!`.
Then in preview (logged in as super_admin): visit `/admin/inquiries` → the inquiry submitted in Task 5 appears; open it, change Status to `contacted`, Save → badge updates and persists; the bulk "Archive" toolbar works; the empty state shows when filters match nothing.

- [ ] **Step 8: Commit**

```bash
git add src/pages/admin/inquiries src/styles/admin.css src/layouts/AdminLayout.astro
git commit -m "feat(inquiries): admin inbox — list, detail, status/notes, bulk; badges + list-UX kit"
```

---

### Task 7: Written guide, optional e2e, final verification

**Files:**
- Create: `docs/admin-guide/inquiries.md`
- Create (optional): `scripts/e2e-inquiry.mjs`

- [ ] **Step 1: Write the superadmin guide section**

```markdown
# Working inquiries (superadmin guide)

## Where leads come from
Every "Inquire" button on the public site — on a work's page, an artist's page, and the contact
modal — sends here. Per-work inquiries are tagged source **artwork** and linked to the piece; the
rest are **contact**. Nothing is emailed yet (see "Turn on email"), so this inbox is the system of
record — check it regularly.

## Working a lead
Open `/admin/inquiries`. Each row shows who, which work, and the status. Open one to read the full
message. Use the **Status** dropdown to move it through the pipeline:

- **new** — just arrived, not yet actioned.
- **contacted** — you've replied / reached out.
- **won** — resulted in a sale or confirmed acquisition.
- **lost** — went cold or declined.
- **archived** — filed away (spam, duplicate, resolved).

Add private **internal notes** for context; the collector never sees these. Use the checkboxes on the
list + **Mark contacted / Archive** to update several at once.

## Replying
Click **Reply by email** — it opens your normal mail app with the collector's address and a subject
pre-filled. Send from there, then set the status to **contacted**.

## Spam protection
A hidden honeypot field plus a per-visitor rate limit block most bots automatically. Genuine junk that
slips through: select it and **Archive** (or **Delete** from the detail page).

## Turn on email (optional, later)
To get an alert the moment an inquiry arrives — and send the collector an automatic acknowledgement —
add a `RESEND_API_KEY` environment variable in Vercel and verify your sending domain in Resend. Until
then the inbox works exactly the same, just without the email notifications.
```

- [ ] **Step 2 (optional): e2e script for the public submit flow**

```js
// scripts/e2e-inquiry.mjs
// Public inquiry capture e2e. Requires: `npm run dev` running + Supabase env configured.
//   Run: node scripts/e2e-inquiry.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:4321';
const browser = await chromium.launch();
const page = await browser.newPage();

// Open a work page and submit an inquiry.
await page.goto(`${BASE}/works`, { waitUntil: 'networkidle' });
const href = await page.evaluate(() => document.querySelector('a[href^="/works/"]')?.getAttribute('href'));
if (!href) { console.error('No work links found'); process.exit(1); }
await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' });

await page.evaluate(() => window.openInquiry('E2E test work', 'e2e'));
await page.fill('#inquireForm [name=name]', 'E2E Tester');
await page.fill('#inquireForm [name=email]', 'e2e@example.com');
await page.fill('#inquireForm [name=message]', 'Automated test inquiry.');
const [resp] = await Promise.all([
  page.waitForResponse((r) => r.url().endsWith('/api/inquire')),
  page.click('#inquireForm button[type=submit]'),
]);
const status = resp.status();
const body = await resp.json().catch(() => ({}));
await page.waitForTimeout(300);
const thanked = await page.locator('#inquireForm', { hasText: 'Thank you' }).count();

await browser.close();
if (status === 200 && body.ok && thanked) {
  console.log('PASS — inquiry captured (200 ok, thank-you shown)');
} else {
  console.error('FAIL', { status, body, thanked });
  process.exit(1);
}
```

- [ ] **Step 3: Full verification**

Run: `npm test` → Expected: all unit suites pass (inquiries + email + existing).
Run: `npm run build` → Expected: `Complete!`.
(Optional, with dev server + Supabase env) Run: `node scripts/e2e-inquiry.mjs` → Expected: `PASS`.

- [ ] **Step 4: Commit**

```bash
git add docs/admin-guide/inquiries.md scripts/e2e-inquiry.mjs
git commit -m "docs(inquiries): superadmin guide + optional public-capture e2e script"
```

---

## Self-review (completed)

- **Spec coverage:** capture endpoint (§4 → Task 4), schema extension (§3 → Task 2), admin inbox list+detail+bulk (§5 → Task 6), dormant Resend (§6 → Task 3), list-UX kit badges/empty/filters (§7 → Task 6), tutorial slice help-drawer + written guide (§8 → Tasks 6–7), tests (§9 → Tasks 1,3,7). The `viewing_room` source value was removed from the spec — not present here. ✅
- **Placeholder scan:** every code step contains complete code; no TBD/TODO. ✅
- **Type consistency:** `Inquiry`/`InquiryRow`/`InquiryStatus`/`InquirySource` used identically across Tasks 1–6; `rowToInquiry`, `isValidStatus`, `isRateLimited`, `validateInquiry`, `isHoneypotTripped` signatures match their definitions and call sites. ✅

## Notes / deferred

- `tldraw` remains an unused dependency after the studio removal — separate cleanup, not part of this plan.
- Rate-limit keys on `x-forwarded-for`; in local dev with no such header all submissions share `ip='unknown'` (the 5/min cap is generous enough for manual testing).
- Future modules (Exhibitions, Journal/Press, Art Fairs, Dashboard/Settings) reuse the badge/table/empty-state/filter kit introduced in Task 6.
