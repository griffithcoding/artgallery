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
