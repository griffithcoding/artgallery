// src/lib/search.test.ts
import { describe, it, expect } from 'vitest';
import { searchAdmin, type SearchDatasets } from './search';

const data: SearchDatasets = {
  artworks: [{ id: 'w1', title: 'Blue Nude', medium: 'Oil', year: 2021, artistName: 'Ada Reef' }],
  artists: [{ id: 'a1', name: 'Ada Reef', discipline: 'Painting' }],
  exhibitions: [{ id: 'e1', title: 'Summer Group', subtitle: 'New works' }],
  fairs: [{ id: 'f1', name: 'Frieze', city: 'London' }],
  inquiries: [{ id: 'i1', name: 'John Buyer', email: 'john@x.com', message: 'Is Blue Nude available?' }],
};

describe('searchAdmin', () => {
  it('returns no groups for a blank query', () => {
    expect(searchAdmin('   ', data)).toEqual([]);
  });
  it('matches across entities case-insensitively', () => {
    const groups = searchAdmin('blue', data);
    const kinds = groups.map((g) => g.kind);
    expect(kinds).toContain('artwork');   // title
    expect(kinds).toContain('inquiry');   // message mentions Blue Nude
    const artwork = groups.find((g) => g.kind === 'artwork')!;
    expect(artwork.hits[0].href).toBe('/admin/artworks/w1');
  });
  it('matches an artwork by its artist name', () => {
    const groups = searchAdmin('ada', data);
    expect(groups.find((g) => g.kind === 'artwork')).toBeTruthy();
    expect(groups.find((g) => g.kind === 'artist')).toBeTruthy();
  });
  it('omits groups with no hits', () => {
    const groups = searchAdmin('frieze', data);
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('fair');
  });
});
