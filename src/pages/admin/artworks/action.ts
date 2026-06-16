import type { APIRoute } from 'astro';
import { createSupabaseServer, createSupabaseAdmin } from '../../../lib/supabase/server';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const auth = createSupabaseServer(cookies, request.headers);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  const f = await request.formData();
  const id = String(f.get('id') ?? '');
  if (id) await createSupabaseAdmin().from('artworks').delete().eq('id', id);
  return redirect('/admin/artworks?deleted=1', 303);
};
