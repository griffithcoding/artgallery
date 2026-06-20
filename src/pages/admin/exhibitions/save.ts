import type { APIRoute } from 'astro';
import { createSupabaseServer, createSupabaseAdmin } from '../../../lib/supabase/server';
import { slugify, uniqueSlug } from '../../../lib/slug';

export const prerender = false;

const STATUSES = new Set(['On View', 'Upcoming', 'Past']);

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const auth = createSupabaseServer(cookies, request.headers);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const f = await request.formData();
  const id = String(f.get('id') ?? '');
  const title = String(f.get('title') ?? '').trim();
  if (!title) return new Response('Title required', { status: 400 });

  const statusRaw = String(f.get('status') ?? 'Upcoming');
  const fields = {
    title,
    subtitle: String(f.get('subtitle') ?? ''),
    status: STATUSES.has(statusRaw) ? statusRaw : 'Upcoming',
    start_date: String(f.get('start_date') ?? '') || null,
    end_date: String(f.get('end_date') ?? '') || null,
    blurb: String(f.get('blurb') ?? ''),
    description: String(f.get('description') ?? ''),
    hero_image_url: String(f.get('hero_image_url') ?? '') || null,
    sort_order: f.get('sort_order') ? Number(f.get('sort_order')) : 0,
  };
  const artistIds = f.getAll('artist_ids').map(String).filter(Boolean);

  const admin = createSupabaseAdmin();
  let exhibitionId = id;

  if (id) {
    await admin.from('exhibitions').update(fields).eq('id', id);
  } else {
    const { data: existing } = await admin.from('exhibitions').select('slug');
    const slug = uniqueSlug(slugify(title), (existing ?? []).map((r) => r.slug));
    const { data: inserted } = await admin
      .from('exhibitions')
      .insert({ ...fields, slug })
      .select('id')
      .single();
    exhibitionId = inserted?.id ?? '';
  }

  // Sync the exhibition_artists join: replace the full set.
  if (exhibitionId) {
    await admin.from('exhibition_artists').delete().eq('exhibition_id', exhibitionId);
    if (artistIds.length) {
      await admin
        .from('exhibition_artists')
        .insert(artistIds.map((artist_id) => ({ exhibition_id: exhibitionId, artist_id })));
    }
  }

  return redirect('/admin/exhibitions?saved=1', 303);
};
