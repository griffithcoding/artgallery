import { describe, it, expect } from 'vitest';
import { rowToArtist, rowToExhibition, formatDateRange, exhibitionYear } from './mappers';
import type { ArtistRow, ExhibitionRow } from './supabase/types';

const base: ArtistRow = {
  id: 'a1', slug: 'jane-doe', name: 'Jane Doe', birthplace: 'Oslo', birth_year: 1980,
  discipline: 'Painting', bio: 'Bio.', portrait_image_url: null,
  represented_since: 2021, active_since: 2008, based_in: 'Brooklyn, NY',
  website_url: 'janedoe.com', instagram_url: '@jane', education: 'MFA, Yale, 2012',
  nationality: 'Norwegian', cv_url: 'cv/abc.pdf', featured: true,
  created_at: '', updated_at: '',
};

describe('rowToArtist enrichment', () => {
  it('maps the new fields', () => {
    const a = rowToArtist(base);
    expect(a.representedSince).toBe(2021);
    expect(a.activeSince).toBe(2008);
    expect(a.basedIn).toBe('Brooklyn, NY');
    expect(a.cvUrl).toBe('cv/abc.pdf');
    expect(a.featured).toBe(true);
    expect(a.nationality).toBe('Norwegian');
  });
});

describe('formatDateRange', () => {
  it('formats a same-year range', () => {
    expect(formatDateRange('2026-05-22', '2026-07-12')).toBe('May 22 – Jul 12, 2026');
  });
  it('formats a cross-year range with both years', () => {
    expect(formatDateRange('2025-12-18', '2026-01-24')).toBe('Dec 18, 2025 – Jan 24, 2026');
  });
  it('formats a single start date', () => {
    expect(formatDateRange('2026-05-22', null)).toBe('May 22, 2026');
  });
  it('formats a single end date', () => {
    expect(formatDateRange(null, '2026-07-12')).toBe('Jul 12, 2026');
  });
  it('returns empty string when both are missing', () => {
    expect(formatDateRange(null, null)).toBe('');
  });
  it('does not skew the day across timezones', () => {
    // string-parsed, so the 1st stays the 1st regardless of TZ
    expect(formatDateRange('2026-01-01', '2026-01-01')).toBe('Jan 1 – Jan 1, 2026');
  });
});

describe('exhibitionYear', () => {
  it('prefers the end year', () => {
    expect(exhibitionYear('2025-12-18', '2026-01-24')).toBe(2026);
  });
  it('falls back to the start year', () => {
    expect(exhibitionYear('2026-05-22', null)).toBe(2026);
  });
  it('is 0 when no dates', () => {
    expect(exhibitionYear(null, null)).toBe(0);
  });
});

const exBase: ExhibitionRow = {
  id: 'ex1', slug: 'soft-architecture', title: 'Soft Architecture',
  subtitle: 'New paintings', status: 'On View',
  start_date: '2026-05-22', end_date: '2026-07-12', blurb: 'A short blurb.',
  description: 'Para one.\n\nPara two.', hero_image_url: 'exhibitions/abc.jpg',
  sort_order: 0, created_at: '', updated_at: '',
};

describe('rowToExhibition', () => {
  it('maps row + joined artist ids', () => {
    const e = rowToExhibition(exBase, ['a1', 'a2']);
    expect(e.id).toBe('ex1');
    expect(e.slug).toBe('soft-architecture');
    expect(e.status).toBe('On View');
    expect(e.dates).toBe('May 22 – Jul 12, 2026');
    expect(e.year).toBe(2026);
    expect(e.artistIds).toEqual(['a1', 'a2']);
    expect(e.blurb).toBe('A short blurb.');
    expect(e.description).toBe('Para one.\n\nPara two.');
    expect(e.heroImage).toBe('exhibitions/abc.jpg');
  });
  it('leaves description/heroImage undefined when empty', () => {
    const e = rowToExhibition({ ...exBase, description: '', hero_image_url: null }, []);
    expect(e.description).toBeUndefined();
    expect(e.heroImage).toBeUndefined();
    expect(e.artistIds).toEqual([]);
  });
});
