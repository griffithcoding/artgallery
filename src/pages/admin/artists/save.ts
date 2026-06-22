import type { APIRoute } from 'astro';
import { createSupabaseServer, createSupabaseAdmin } from '../../../lib/supabase/server';
import { slugify, uniqueSlug } from '../../../lib/slug';
import { okRedirect, errRedirect } from '../../../lib/adminResult';
import { sanitizeRichHtml } from '../../../lib/sanitize';

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
    bio: sanitizeRichHtml(String(f.get('bio') ?? '')),
    portrait_image_url: String(f.get('portrait_image_url') ?? '') || null,
    represented_since: f.get('represented_since') ? Number(f.get('represented_since')) : null,
    active_since: f.get('active_since') ? Number(f.get('active_since')) : null,
    based_in: String(f.get('based_in') ?? ''),
    website_url: String(f.get('website_url') ?? ''),
    instagram_url: String(f.get('instagram_url') ?? ''),
    education: String(f.get('education') ?? ''),
    cv_url: String(f.get('cv_url') ?? ''),
    featured: f.get('featured') === '1',
  };

  if (id) {
    const { error } = await admin.from('artists').update(fields).eq('id', id);
    if (error) return redirect(errRedirect('/admin/artists', error.message), 303);
  } else {
    const { data: existing } = await admin.from('artists').select('slug');
    const slug = uniqueSlug(slugify(name), (existing ?? []).map((r) => r.slug));
    const { error } = await admin.from('artists').insert({ ...fields, slug });
    if (error) return redirect(errRedirect('/admin/artists', error.message), 303);
  }
  return redirect(okRedirect('/admin/artists'), 303);
};
