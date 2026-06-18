import { describe, it, expect } from 'vitest';
import { normalizeBlocks, publish, BLOCK_TYPES } from './blocks';

describe('normalizeBlocks', () => {
  it('fills prop defaults for a known type', () => {
    const out = normalizeBlocks([{ id: 'a', type: 'heading', props: {} }]);
    expect(out).toEqual([{ id: 'a', type: 'heading', props: { text: '', level: 2 } }]);
  });

  it('preserves provided props over defaults', () => {
    const out = normalizeBlocks([{ id: 'h', type: 'hero', props: { heading: 'Hi' } }]);
    expect(out[0].props).toEqual({ heading: 'Hi', sub: '', imageUrl: '' });
  });

  it('drops unknown block types', () => {
    const out = normalizeBlocks([{ id: 'x', type: 'bogus', props: {} } as any]);
    expect(out).toEqual([]);
  });

  it('preserves order and fills a missing id deterministically', () => {
    const out = normalizeBlocks([
      { type: 'spacer', props: {} } as any,
      { id: 'q', type: 'quote', props: {} },
    ]);
    expect(out.map((b) => b.id)).toEqual(['b-0', 'q']);
  });

  it('coerces a non-array to []', () => {
    expect(normalizeBlocks(null as any)).toEqual([]);
  });

  it('exposes all seven block types', () => {
    expect([...BLOCK_TYPES].sort()).toEqual(
      ['hero', 'heading', 'richText', 'image', 'worksGrid', 'quote', 'spacer'].sort()
    );
  });
});

describe('publish', () => {
  it('returns a normalized deep clone (no shared refs)', () => {
    const draft = [{ id: 'a', type: 'heading', props: { text: 'X', level: 3 } }];
    const snap = publish(draft);
    expect(snap).toEqual([{ id: 'a', type: 'heading', props: { text: 'X', level: 3 } }]);
    (snap[0].props as any).text = 'Y';
    expect(draft[0].props.text).toBe('X');
  });
});
