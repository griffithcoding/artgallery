import type { APIRoute } from 'astro';
import { createSupabaseServer, createSupabaseAdmin } from '../../../lib/supabase/server';

export const prerender = false;

// Owner = anyone not explicitly a creator/contributor (unset role defaults to
// the gallery owner, matching the middleware's resolveRole).
const isOwner = (meta: Record<string, unknown> | undefined) =>
  meta?.role !== 'creator' && meta?.role !== 'contributor';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const auth = createSupabaseServer(cookies, request.headers);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (!isOwner(user.app_metadata as Record<string, unknown> | undefined)) {
    return new Response('Forbidden', { status: 403 });
  }

  const f = await request.formData();
  const artistId = String(f.get('artist_id') ?? '');
  const action = String(f.get('action') ?? 'link');
  const email = String(f.get('email') ?? '').trim().toLowerCase();
  const password = String(f.get('password') ?? '');
  if (!artistId) return new Response('Missing artist', { status: 400 });
  const back = (q: string) => redirect(`/admin/artists/${artistId}?${q}`, 303);

  const admin = createSupabaseAdmin();
  const { data: artist } = await admin.from('artists').select('id').eq('id', artistId).maybeSingle();
  if (!artist) return new Response('Artist not found', { status: 404 });

  // Load all users once, then operate in memory.
  type U = { id: string; email?: string; app_metadata?: Record<string, unknown> };
  const users: U[] = [];
  for (let page = 1; page <= 25; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (!data) break;
    users.push(...(data.users as unknown as U[]));
    if (data.users.length < 200) break;
  }
  const linkedToArtist = users.filter((u) => u.app_metadata?.artist_id === artistId);

  if (action === 'unlink') {
    const targets = email ? users.filter((u) => u.email?.toLowerCase() === email) : linkedToArtist;
    for (const u of targets) {
      await admin.auth.admin.updateUserById(u.id, { app_metadata: { ...(u.app_metadata ?? {}), artist_id: null } });
    }
    return back('creator=unlinked');
  }

  if (!email) return back('creator_error=' + encodeURIComponent('Enter an email.'));
  let targetId: string;
  const existing = users.find((u) => u.email?.toLowerCase() === email);
  if (!existing) {
    if (!password) return back('creator_error=' + encodeURIComponent('Set a password to create the account.'));
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: 'creator', artist_id: artistId },
    });
    if (error || !created.user) {
      return back('creator_error=' + encodeURIComponent(error?.message ?? 'Could not create account.'));
    }
    targetId = created.user.id;
  } else {
    const patch: { app_metadata: Record<string, unknown>; password?: string } = {
      app_metadata: { ...(existing.app_metadata ?? {}), role: 'creator', artist_id: artistId },
    };
    if (password) patch.password = password;
    const { error } = await admin.auth.admin.updateUserById(existing.id, patch);
    if (error) return back('creator_error=' + encodeURIComponent(error.message));
    targetId = existing.id;
  }

  // One creator per artist: clear the link on any other previously-linked user.
  for (const u of linkedToArtist) {
    if (u.id !== targetId) {
      await admin.auth.admin.updateUserById(u.id, { app_metadata: { ...(u.app_metadata ?? {}), artist_id: null } });
    }
  }

  return back('creator=linked');
};
