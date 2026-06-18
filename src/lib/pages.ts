// Dual-mode read seam for composer pages (mirrors gallery.ts). On any DB error or
// when Supabase is unconfigured, callers get null/[] — the site never breaks.
import { createSupabaseAnon, createSupabaseAdmin, isSupabaseConfigured } from './supabase/server';
import { normalizeBlocks, type Block } from './blocks';
import type { PageRow } from './supabase/types';

export interface Page { slug: string; title: string; blocks: Block[]; }

/** Pure: pick a column from a row and normalize it to Block[]. */
export function pageRowToBlocks(row: Pick<PageRow, 'blocks' | 'published_blocks'>, which: 'draft' | 'published'): Block[] {
  return normalizeBlocks(which === 'draft' ? row.blocks : row.published_blocks);
}

/** Public: the published page, or null. */
export async function getPage(slug: string): Promise<Page | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createSupabaseAnon();
    const { data, error } = await sb.from('pages').select('*').eq('slug', slug).eq('status', 'published').maybeSingle();
    if (error || !data) return null;
    const row = data as PageRow;
    return { slug: row.slug, title: row.title, blocks: pageRowToBlocks(row, 'published') };
  } catch {
    return null;
  }
}

/** Editor: the draft (service-role; superadmin endpoints only). */
export async function getPageDraft(slug: string): Promise<Page | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createSupabaseAdmin();
    const { data, error } = await sb.from('pages').select('*').eq('slug', slug).maybeSingle();
    if (error || !data) return null;
    const row = data as PageRow;
    return { slug: row.slug, title: row.title, blocks: pageRowToBlocks(row, 'draft') };
  } catch {
    return null;
  }
}
