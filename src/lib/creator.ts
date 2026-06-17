import { createSupabaseAdmin } from './supabase/server';

/**
 * The artist record a creator owns, resolved from app_metadata.artist_id
 * (exposed on locals.user.artistId by the middleware). Returns null when the
 * creator account hasn't been linked to an artist yet.
 */
export async function getOwnedArtist(artistId: string | undefined) {
  if (!artistId) return null;
  const { data } = await createSupabaseAdmin()
    .from('artists')
    .select('*')
    .eq('id', artistId)
    .maybeSingle();
  return data ?? null;
}

/**
 * Email of the creator account currently linked to an artist (if any), found by
 * scanning auth users for app_metadata.artist_id === artistId. One creator per
 * artist is enforced when linking.
 */
export async function getLinkedCreatorEmail(artistId: string): Promise<string | null> {
  const admin = createSupabaseAdmin();
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) return null;
    const u = data.users.find(
      (x) => (x.app_metadata as Record<string, unknown> | undefined)?.artist_id === artistId
    );
    if (u) return u.email ?? null;
    if (data.users.length < 200) break;
  }
  return null;
}
