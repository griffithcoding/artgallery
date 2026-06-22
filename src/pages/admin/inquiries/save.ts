import type { APIRoute } from 'astro';
import { createSupabaseServer, createSupabaseAdmin } from '../../../lib/supabase/server';
import { isValidStatus } from '../../../lib/inquiries';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const auth = createSupabaseServer(cookies, request.headers);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const f = await request.formData();
  const id = String(f.get('id') ?? '');
  if (!id) return new Response('Missing id', { status: 400 });

  const fields: Record<string, unknown> = { internal_notes: String(f.get('internal_notes') ?? '') };
  const status = String(f.get('status') ?? '');
  if (isValidStatus(status)) {
    fields.status = status;
    fields.status_changed_at = new Date().toISOString();
  }
  await createSupabaseAdmin().from('inquiries').update(fields).eq('id', id);
  return redirect(`/admin/inquiries/${id}?saved=1`, 303);
};
