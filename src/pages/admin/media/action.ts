import type { APIRoute } from 'astro';
import { createSupabaseServer, createSupabaseAdmin } from '../../../lib/supabase/server';
import { okRedirect, errRedirect } from '../../../lib/adminResult';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const auth = createSupabaseServer(cookies, request.headers);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const f = await request.formData();
  const path = String(f.get('path') ?? '');
  if (!path) return redirect(errRedirect('/admin/media', 'No image specified.'), 303);

  const { error } = await createSupabaseAdmin().storage.from('gallery-images').remove([path]);
  if (error) return redirect(errRedirect('/admin/media', error.message), 303);
  return redirect(okRedirect('/admin/media', 'deleted'), 303);
};
