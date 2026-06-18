import { describe, it, expect } from 'vitest';
import { pageRowToBlocks } from './pages';

describe('pageRowToBlocks', () => {
  it('reads the published column by default and normalizes', () => {
    const row = {
      published_blocks: [{ id: 'a', type: 'heading', props: { text: 'Live' } }],
      blocks: [{ id: 'b', type: 'heading', props: { text: 'Draft' } }],
    } as any;
    expect(pageRowToBlocks(row, 'published')).toEqual([
      { id: 'a', type: 'heading', props: { text: 'Live', level: 2 } },
    ]);
  });

  it('reads the draft column when asked', () => {
    const row = {
      published_blocks: [],
      blocks: [{ id: 'b', type: 'heading', props: { text: 'Draft' } }],
    } as any;
    expect(pageRowToBlocks(row, 'draft')[0].props.text).toBe('Draft');
  });

  it('tolerates a null/garbage column', () => {
    expect(pageRowToBlocks({ published_blocks: null } as any, 'published')).toEqual([]);
  });
});
