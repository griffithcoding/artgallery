import type { APIRoute } from 'astro';
import { createSupabaseServer, createSupabaseAdmin } from '../../../lib/supabase/server';

export const prerender = false;

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX = 8 * 1024 * 1024;
const isOwner = (m: Record<string, unknown> | undefined) => m?.role !== 'creator' && m?.role !== 'contributor';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const auth = createSupabaseServer(cookies, request.headers);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (!isOwner(user.app_metadata as Record<string, unknown> | undefined)) return new Response('Forbidden', { status: 403 });

  const f = await request.formData();
  const file = f.get('file');
  if (!(file instanceof File) || !file.size) return redirect('/admin/homepage?err=' + encodeURIComponent('Choose an image.'), 303);
  if (!ALLOWED.includes(file.type)) return redirect('/admin/homepage?err=' + encodeURIComponent('Use a JPG, PNG, or WebP.'), 303);
  if (file.size > MAX) return redirect('/admin/homepage?err=' + encodeURIComponent('Image must be under 8MB.'), 303);

  // Fixed storage path so the homepage can resolve it without a settings table.
  const { error } = await createSupabaseAdmin().storage
    .from('gallery-images')
    .upload('site/hero', file, { contentType: file.type, upsert: true, cacheControl: '60' });
  if (error) return redirect('/admin/homepage?err=' + encodeURIComponent(error.message), 303);
  return redirect('/admin/homepage?saved=1', 303);
};
