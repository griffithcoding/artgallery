import type { APIRoute } from 'astro';
import { createSupabaseServer, createSupabaseAdmin } from '../../../lib/supabase/server';
import { okRedirect, errRedirect } from '../../../lib/adminResult';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const auth = createSupabaseServer(cookies, request.headers);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  const f = await request.formData();
  const id = String(f.get('id') ?? '');
  if (id) {
    const { error } = await createSupabaseAdmin().from('artworks').delete().eq('id', id);
    if (error) return redirect(errRedirect('/admin/artworks', error.message), 303);
  }
  return redirect(okRedirect('/admin/artworks', 'deleted'), 303);
};
