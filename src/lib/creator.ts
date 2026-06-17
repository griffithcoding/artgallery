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
