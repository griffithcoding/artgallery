// src/lib/media.test.ts
import { describe, it, expect } from 'vitest';
import { collectReferencedUrls, classifyObjects } from './media';

describe('media', () => {
  it('collectReferencedUrls drops nulls/blanks and dedupes', () => {
    const set = collectReferencedUrls({
      artworkImages: ['https://x/a.jpg', null, ''],
      artistPortraits: ['https://x/p.jpg', 'https://x/a.jpg'],
      exhibitionHeroes: [null],
      postCovers: ['https://x/c.jpg'],
    });
    expect(set.has('https://x/a.jpg')).toBe(true);
    expect(set.has('https://x/c.jpg')).toBe(true);
    expect(set.size).toBe(3);
  });
  it('classifyObjects flags in-use via the referenced set', () => {
    const ref = new Set(['https://x/a.jpg']);
    const items = classifyObjects([{ path: 'artworks/a.jpg', url: 'https://x/a.jpg' }, { path: 'library/z.jpg', url: 'https://x/z.jpg' }], ref, '');
    expect(items[0].inUse).toBe(true);
    expect(items[1].inUse).toBe(false);
  });
  it('classifyObjects also flags in-use when the URL appears in page blocks JSON', () => {
    const items = classifyObjects([{ path: 'pages/h.jpg', url: 'https://x/h.jpg' }], new Set(), '[{"type":"hero","src":"https://x/h.jpg"}]');
    expect(items[0].inUse).toBe(true);
  });
});
