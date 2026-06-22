import type { APIRoute } from 'astro';
import { createSupabaseServer, createSupabaseAdmin } from '../../../lib/supabase/server';
import { okRedirect, errRedirect } from '../../../lib/adminResult';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const auth = createSupabaseServer(cookies, request.headers);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const f = await request.formData();
  const fields = {
    id: 1,
    email: String(f.get('email') ?? ''),
    phone: String(f.get('phone') ?? ''),
    hours: String(f.get('hours') ?? ''),
    address_line: String(f.get('address_line') ?? ''),
    address_city: String(f.get('address_city') ?? ''),
    instagram_url: String(f.get('instagram_url') ?? ''),
  };
  const { error } = await createSupabaseAdmin().from('site_settings').upsert(fields);
  if (error) return redirect(errRedirect('/admin/settings', error.message), 303);
  return redirect(okRedirect('/admin/settings'), 303);
};
