import type { APIRoute } from 'astro';
import { createSupabaseServer, createSupabaseAdmin } from '../../../lib/supabase/server';
import { slugify, uniqueSlug } from '../../../lib/slug';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const auth = createSupabaseServer(cookies, request.headers);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const f = await request.formData();
  const id = String(f.get('id') ?? '');
  const name = String(f.get('name') ?? '').trim();
  if (!name) return new Response('Name required', { status: 400 });

  const admin = createSupabaseAdmin();
  const fields = {
    name,
    birthplace: String(f.get('birthplace') ?? ''),
    birth_year: f.get('birth_year') ? Number(f.get('birth_year')) : null,
    discipline: String(f.get('discipline') ?? ''),
    bio: String(f.get('bio') ?? ''),
    portrait_image_url: String(f.get('portrait_image_url') ?? '') || null,
  };

  if (id) {
    await admin.from('artists').update(fields).eq('id', id);
  } else {
    const { data: existing } = await admin.from('artists').select('slug');
    const slug = uniqueSlug(slugify(name), (existing ?? []).map((r) => r.slug));
    await admin.from('artists').insert({ ...fields, slug });
  }
  return redirect('/admin/artists?saved=1', 303);
};
