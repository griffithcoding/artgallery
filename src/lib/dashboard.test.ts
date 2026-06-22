// src/lib/dashboard.test.ts
import { describe, it, expect } from 'vitest';
import { buildChecklist, checklistComplete } from './dashboard';

const base = { artists: 0, artworks: 0, exhibitions: 0, fairs: 0, homepageHero: false };

describe('buildChecklist', () => {
  it('returns five steps, all not-done for an empty gallery', () => {
    const items = buildChecklist(base);
    expect(items).toHaveLength(5);
    expect(items.every((i) => !i.done)).toBe(true);
    expect(items[0].href).toBe('/admin/artists/new');
  });
  it('marks a step done when its count is positive', () => {
    const items = buildChecklist({ ...base, artworks: 3, homepageHero: true });
    expect(items.find((i) => i.key === 'artwork')!.done).toBe(true);
    expect(items.find((i) => i.key === 'homepage')!.done).toBe(true);
    expect(items.find((i) => i.key === 'artist')!.done).toBe(false);
  });
  it('checklistComplete is true only when every step is done', () => {
    expect(checklistComplete(buildChecklist(base))).toBe(false);
    expect(checklistComplete(buildChecklist({ artists: 1, artworks: 1, exhibitions: 1, fairs: 1, homepageHero: true }))).toBe(true);
  });
});
