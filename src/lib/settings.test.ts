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
