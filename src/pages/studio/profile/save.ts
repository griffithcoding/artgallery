import type { APIRoute } from 'astro';
import { createSupabaseServer, createSupabaseAdmin } from '../../../lib/supabase/server';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const auth = createSupabaseServer(cookies, request.headers);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  const artistId = (user.app_metadata as Record<string, unknown> | undefined)?.artist_id;
  if (typeof artistId !== 'string') return new Response('No artist linked to this account', { status: 403 });

  const f = await request.formData();
  const name = String(f.get('name') ?? '').trim();
  if (!name) return new Response('Name required', { status: 400 });

  const fields = {
    name,
    birthplace: String(f.get('birthplace') ?? ''),
    birth_year: f.get('birth_year') ? Number(f.get('birth_year')) : null,
    discipline: String(f.get('discipline') ?? ''),
    bio: String(f.get('bio') ?? ''),
    portrait_image_url: String(f.get('portrait_image_url') ?? '') || null,
    active_since: f.get('active_since') ? Number(f.get('active_since')) : null,
    based_in: String(f.get('based_in') ?? ''),
    nationality: String(f.get('nationality') ?? ''),
    education: String(f.get('education') ?? ''),
    website_url: String(f.get('website_url') ?? ''),
    instagram_url: String(f.get('instagram_url') ?? ''),
    cv_url: String(f.get('cv_url') ?? ''),
  };

  // Scoped to the creator's own artist — they can never edit another's page.
  await createSupabaseAdmin().from('artists').update(fields).eq('id', artistId);
  return redirect('/studio/profile?saved=1', 303);
};
