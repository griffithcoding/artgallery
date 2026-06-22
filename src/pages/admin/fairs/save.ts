import type { APIRoute } from 'astro';
import { createSupabaseServer, createSupabaseAdmin } from '../../../lib/supabase/server';

export const prerender = false;

const STATUSES = new Set(['Upcoming', 'Past']);

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const auth = createSupabaseServer(cookies, request.headers);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const f = await request.formData();
  const id = String(f.get('id') ?? '');
  const name = String(f.get('name') ?? '').trim();
  if (!name) return new Response('Name required', { status: 400 });

  const statusRaw = String(f.get('status') ?? 'Upcoming');
  const fields = {
    name,
    city: String(f.get('city') ?? ''),
    booth: String(f.get('booth') ?? ''),
    dates: String(f.get('dates') ?? ''),
    status: STATUSES.has(statusRaw) ? statusRaw : 'Upcoming',
    sort_order: f.get('sort_order') ? Number(f.get('sort_order')) : 0,
  };

  const admin = createSupabaseAdmin();
  if (id) {
    await admin.from('fairs').update(fields).eq('id', id);
  } else {
    await admin.from('fairs').insert(fields);
  }
  return redirect('/admin/fairs?saved=1', 303);
};
