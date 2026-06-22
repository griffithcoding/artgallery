import type { APIRoute } from 'astro';
import { createSupabaseServer, createSupabaseAdmin } from '../../../lib/supabase/server';
import { isValidStatus } from '../../../lib/inquiries';
import { okRedirect, errRedirect } from '../../../lib/adminResult';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const auth = createSupabaseServer(cookies, request.headers);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const f = await request.formData();
  const ids = f.getAll('ids').map(String).filter(Boolean);
  const bulk = String(f.get('bulk') ?? '');
  if (ids.length === 0) return redirect('/admin/inquiries', 303);

  const admin = createSupabaseAdmin();
  if (bulk === 'delete') {
    const { error } = await admin.from('inquiries').delete().in('id', ids);
    if (error) return redirect(errRedirect('/admin/inquiries', error.message), 303);
    return redirect(okRedirect('/admin/inquiries', 'updated'), 303);
  }
  if (isValidStatus(bulk)) {
    const { error } = await admin.from('inquiries').update({ status: bulk, status_changed_at: new Date().toISOString() }).in('id', ids);
    if (error) return redirect(errRedirect('/admin/inquiries', error.message), 303);
    return redirect(okRedirect('/admin/inquiries', 'updated'), 303);
  }
  return redirect('/admin/inquiries', 303);
};
