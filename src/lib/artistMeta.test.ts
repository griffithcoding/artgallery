import { describe, it, expect } from 'vitest';
import { yearsActive, normalizeUrl, instagramUrl } from './artistMeta';

describe('yearsActive', () => {
  it('derives years from a start year', () => expect(yearsActive(2011, 2026)).toBe(15));
  it('returns null when unset', () => expect(yearsActive(undefined, 2026)).toBeNull());
  it('clamps a future start to 0', () => expect(yearsActive(2030, 2026)).toBe(0));
});

describe('normalizeUrl', () => {
  it('passes through an http(s) url', () => expect(normalizeUrl('https://x.com')).toBe('https://x.com'));
  it('prefixes a bare domain', () => expect(normalizeUrl('x.com')).toBe('https://x.com'));
  it('returns null for empty', () => expect(normalizeUrl('  ')).toBeNull());
});

describe('instagramUrl', () => {
  it('builds from a handle', () => expect(instagramUrl('@artist')).toBe('https://instagram.com/artist'));
  it('passes a full url through', () => expect(instagramUrl('https://instagram.com/a')).toBe('https://instagram.com/a'));
  it('returns null for empty', () => expect(instagramUrl('')).toBeNull());
});
