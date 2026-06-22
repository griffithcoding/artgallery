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
