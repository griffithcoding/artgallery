// Superadmin only (gated by middleware + CSRF). Saves draft; optionally publishes.
import type { APIRoute } from 'astro';
import { createSupabaseAdmin } from '../../../lib/supabase/server';
import { normalizeBlocks, publish } from '../../../lib/blocks';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || user.role !== 'super_admin') return new Response('Forbidden', { status: 403 });

  let body: { slug?: string; blocks?: unknown; publish?: boolean };
  try { body = await request.json(); } catch { return new Response('Bad JSON', { status: 400 }); }
  const slug = String(body.slug ?? '');
  if (!slug) return new Response('Missing slug', { status: 400 });

  const draft = normalizeBlocks(body.blocks);
  const patch: Record<string, unknown> = { blocks: draft, updated_by: user.id, updated_at: new Date().toISOString() };
  if (body.publish) { patch.published_blocks = publish(draft); patch.status = 'published'; }

  const sb = createSupabaseAdmin();
  const { error } = await sb.from('pages').update(patch).eq('slug', slug);
  if (error) return new Response(error.message, { status: 500 });
  return new Response(JSON.stringify({ ok: true, published: Boolean(body.publish) }), {
    status: 200, headers: { 'content-type': 'application/json' },
  });
};
