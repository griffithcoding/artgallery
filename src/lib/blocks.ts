// Pure block model for the page composer. No I/O — unit-tested.

export type BlockType =
  | 'hero' | 'heading' | 'richText' | 'image' | 'worksGrid' | 'quote' | 'spacer';

export const BLOCK_TYPES: readonly BlockType[] = [
  'hero', 'heading', 'richText', 'image', 'worksGrid', 'quote', 'spacer',
] as const;

export interface Block {
  id: string;
  type: BlockType;
  props: Record<string, unknown>;
}

const DEFAULTS: Record<BlockType, Record<string, unknown>> = {
  hero: { heading: '', sub: '', imageUrl: '' },
  heading: { text: '', level: 2 },
  richText: { html: '' },
  image: { url: '', alt: '', caption: '' },
  worksGrid: { workIds: [], cols: 3 },
  quote: { text: '', cite: '' },
  spacer: { size: 'md' },
};

function isBlockType(t: unknown): t is BlockType {
  return typeof t === 'string' && (BLOCK_TYPES as readonly string[]).includes(t);
}

/** Coerce arbitrary input into a clean Block[]: drop unknown types, fill defaults,
 *  preserve order, and assign a deterministic id when one is missing. */
export function normalizeBlocks(input: unknown): Block[] {
  if (!Array.isArray(input)) return [];
  const out: Block[] = [];
  input.forEach((raw, i) => {
    if (!raw || typeof raw !== 'object') return;
    const r = raw as Partial<Block>;
    if (!isBlockType(r.type)) return;
    const id = typeof r.id === 'string' && r.id ? r.id : `b-${i}`;
    const props = { ...DEFAULTS[r.type], ...(r.props ?? {}) };
    out.push({ id, type: r.type, props });
  });
  return out;
}

/** Snapshot a draft for publishing: normalized deep clone (no shared references). */
export function publish(draft: unknown): Block[] {
  return normalizeBlocks(JSON.parse(JSON.stringify(normalizeBlocks(draft))));
}

/** Build a normalized default block of `type` with the given id. */
export function defaultBlock(type: BlockType, id: string): Block {
  return normalizeBlocks([{ id, type, props: {} }])[0];
}

/** Immutably insert `block` at `index` (clamped to [0, length]). */
export function insertBlockAt(blocks: Block[], block: Block, index: number): Block[] {
  const out = blocks.slice();
  const i = Math.max(0, Math.min(index, out.length));
  out.splice(i, 0, block);
  return out;
}

/** Immutably remove the block with `id` (no-op if absent). */
export function removeBlock(blocks: Block[], id: string): Block[] {
  return blocks.filter((b) => b.id !== id);
}

/** Immutably reorder to match `orderedIds`; unknown ids ignored, missing blocks appended. */
export function reorderByIds(blocks: Block[], orderedIds: string[]): Block[] {
  const map = new Map(blocks.map((b) => [b.id, b]));
  const out: Block[] = [];
  for (const id of orderedIds) { const b = map.get(id); if (b) { out.push(b); map.delete(id); } }
  for (const b of map.values()) out.push(b);
  return out;
}
