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
  const id = String(f.get('id') ?? '');
  if (id) {
    const admin = createSupabaseAdmin();
    // Only delete if the work belongs to this creator.
    const { data: existing } = await admin.from('artworks').select('artist_id').eq('id', id).maybeSingle();
    if (existing && existing.artist_id === artistId) {
      await admin.from('artworks').delete().eq('id', id);
    }
  }
  return redirect('/studio/works?deleted=1', 303);
};
