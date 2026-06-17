import type { APIRoute } from 'astro';
import { createSupabaseServer, createSupabaseAdmin } from '../../../lib/supabase/server';
import { slugify, uniqueSlug } from '../../../lib/slug';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const auth = createSupabaseServer(cookies, request.headers);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  const artistId = (user.app_metadata as Record<string, unknown> | undefined)?.artist_id;
  if (typeof artistId !== 'string') return new Response('No artist linked to this account', { status: 403 });

  const f = await request.formData();
  const id = String(f.get('id') ?? '');
  const title = String(f.get('title') ?? '').trim();
  if (!title) return new Response('Title required', { status: 400 });

  const admin = createSupabaseAdmin();
  // artist_id is forced to the creator's own artist — never taken from input.
  const fields = {
    title,
    artist_id: artistId,
    year: f.get('year') ? Number(f.get('year')) : null,
    medium: String(f.get('medium') ?? ''),
    category: String(f.get('category') ?? ''),
    subject: String(f.get('subject') ?? ''),
    dimensions: String(f.get('dimensions') ?? ''),
    ratio: String(f.get('ratio') ?? 'square'),
    availability: String(f.get('availability') ?? 'Available'),
    image_url: String(f.get('image_url') ?? '') || null,
  };

  if (id) {
    // Verify the work belongs to this creator before updating.
    const { data: existing } = await admin.from('artworks').select('artist_id').eq('id', id).maybeSingle();
    if (!existing || existing.artist_id !== artistId) return new Response('Forbidden', { status: 403 });
    await admin.from('artworks').update(fields).eq('id', id);
  } else {
    const { data: all } = await admin.from('artworks').select('slug');
    const slug = uniqueSlug(slugify(title), (all ?? []).map((r) => r.slug));
    await admin.from('artworks').insert({ ...fields, slug });
  }
  return redirect('/studio/works?saved=1', 303);
};
