import { describe, it, expect } from 'vitest';
import { rowToArtist } from './mappers';
import type { ArtistRow } from './supabase/types';

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
