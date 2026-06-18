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

import { insertBlockAt, removeBlock, reorderByIds, defaultBlock } from './blocks';

describe('insertBlockAt', () => {
  const a = { id: 'a', type: 'spacer', props: {} };
  const b = { id: 'b', type: 'spacer', props: {} };
  const x = { id: 'x', type: 'spacer', props: {} };
  it('inserts at an index', () => expect(insertBlockAt([a, b], x, 1).map((n) => n.id)).toEqual(['a', 'x', 'b']));
  it('clamps a high index to the end', () => expect(insertBlockAt([a], x, 99).map((n) => n.id)).toEqual(['a', 'x']));
  it('clamps a negative index to the start', () => expect(insertBlockAt([a], x, -5).map((n) => n.id)).toEqual(['x', 'a']));
  it('does not mutate the input', () => { const src = [a]; insertBlockAt(src, x, 0); expect(src).toEqual([a]); });
});

describe('removeBlock', () => {
  const a = { id: 'a', type: 'spacer', props: {} };
  const b = { id: 'b', type: 'spacer', props: {} };
  it('removes by id', () => expect(removeBlock([a, b], 'a').map((n) => n.id)).toEqual(['b']));
  it('no-ops on unknown id', () => expect(removeBlock([a, b], 'zz').map((n) => n.id)).toEqual(['a', 'b']));
});

describe('reorderByIds', () => {
  const a = { id: 'a', type: 'spacer', props: {} };
  const b = { id: 'b', type: 'spacer', props: {} };
  const c = { id: 'c', type: 'spacer', props: {} };
  it('reorders to match the id list', () => expect(reorderByIds([a, b, c], ['c', 'a', 'b']).map((n) => n.id)).toEqual(['c', 'a', 'b']));
  it('ignores unknown ids and appends missing ones', () => expect(reorderByIds([a, b, c], ['c', 'zz']).map((n) => n.id)).toEqual(['c', 'a', 'b']));
});

describe('defaultBlock', () => {
  it('builds a normalized block of a type with default props + id', () => {
    expect(defaultBlock('heading', 'h9')).toEqual({ id: 'h9', type: 'heading', props: { text: '', level: 2 } });
  });
});
