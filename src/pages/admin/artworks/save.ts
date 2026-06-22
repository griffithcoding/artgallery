import type { APIRoute } from 'astro';
import { createSupabaseServer, createSupabaseAdmin } from '../../../lib/supabase/server';
import { slugify, uniqueSlug } from '../../../lib/slug';
import { okRedirect, errRedirect } from '../../../lib/adminResult';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const auth = createSupabaseServer(cookies, request.headers);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const f = await request.formData();
  const id = String(f.get('id') ?? '');
  const title = String(f.get('title') ?? '').trim();
  if (!title) return new Response('Title required', { status: 400 });

  const admin = createSupabaseAdmin();
  const fields = {
    title,
    artist_id: String(f.get('artist_id') ?? '') || null,
    year: f.get('year') ? Number(f.get('year')) : null,
    medium: String(f.get('medium') ?? ''),
    category: String(f.get('category') ?? ''),
    subject: String(f.get('subject') ?? ''),
    dimensions: String(f.get('dimensions') ?? ''),
    ratio: String(f.get('ratio') ?? 'square'),
    availability: String(f.get('availability') ?? 'Available'),
    image_url: String(f.get('image_url') ?? '') || null,
    featured: f.get('featured') === 'on',
    sort_order: f.get('sort_order') ? Number(f.get('sort_order')) : 0,
  };

  if (id) {
    const { error } = await admin.from('artworks').update(fields).eq('id', id);
    if (error) return redirect(errRedirect('/admin/artworks', error.message), 303);
  } else {
    const { data: existing } = await admin.from('artworks').select('slug');
    const slug = uniqueSlug(slugify(title), (existing ?? []).map((r) => r.slug));
    const { error } = await admin.from('artworks').insert({ ...fields, slug });
    if (error) return redirect(errRedirect('/admin/artworks', error.message), 303);
  }
  return redirect(okRedirect('/admin/artworks'), 303);
};
