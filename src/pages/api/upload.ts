import type { APIRoute } from 'astro';
import { createSupabaseServer, createSupabaseAdmin } from '../../lib/supabase/server';

export const prerender = false;

const ALLOWED_IMG = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMG = 5 * 1024 * 1024;
const MAX_CV = 10 * 1024 * 1024;
const PREFIXES = new Set(['artworks', 'artists', 'posts', 'cv', 'pages', 'exhibitions']);

export const POST: APIRoute = async ({ request, cookies }) => {
  const auth = createSupabaseServer(cookies, request.headers);
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const form = await request.formData();
  const file = form.get('file');
  const kindRaw = String(form.get('kind') ?? 'artworks');
  const kind = PREFIXES.has(kindRaw) ? kindRaw : 'artworks';
  if (!(file instanceof File)) return new Response('No file', { status: 400 });
  const isCv = kind === 'cv';
  const allowed = isCv ? ['application/pdf'] : ALLOWED_IMG;
  const max = isCv ? MAX_CV : MAX_IMG;
  if (!allowed.includes(file.type)) return new Response('Bad type', { status: 415 });
  if (file.size > max) return new Response('Too large', { status: 413 });

  const ext = isCv ? 'pdf' : file.type.split('/')[1].replace('jpeg', 'jpg');
  const path = `${kind}/${crypto.randomUUID()}.${ext}`;
  const admin = createSupabaseAdmin();
  const { error } = await admin.storage
    .from('gallery-images')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return new Response(error.message, { status: 500 });

  const { data } = admin.storage.from('gallery-images').getPublicUrl(path);
  return new Response(JSON.stringify({ url: data.publicUrl }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
