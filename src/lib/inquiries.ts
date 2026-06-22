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
