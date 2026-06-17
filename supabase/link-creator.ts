// One-off: link a creator account to one artist record via app_metadata.artist_id,
// which the middleware reads to scope the creator portal. No schema change needed.
// Run: npx -y tsx supabase/link-creator.ts  (reads .env)
import { createClient } from '@supabase/supabase-js';

process.loadEnvFile();
const url = process.env.PUBLIC_SUPABASE_URL!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, service, { auth: { persistSession: false } });

const CREATOR_EMAIL = process.env.CREATOR_EMAIL || 'artist@versogallery.com';
const ARTIST_NAME = process.env.ARTIST_NAME || ''; // optional: link to a specific artist by name

async function main() {
  // Find the creator user (listUsers is paginated).
  let creator: { id: string; app_metadata?: Record<string, unknown> } | undefined;
  for (let page = 1; page <= 25 && !creator; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    creator = data.users.find((u) => u.email === CREATOR_EMAIL) as typeof creator;
    if (data.users.length < 200) break;
  }
  if (!creator) {
    console.error(`Creator user not found: ${CREATOR_EMAIL}`);
    process.exit(1);
  }

  // Pick the artist to link: by name if given, else the first alphabetically.
  const q = admin.from('artists').select('id, name');
  const { data: artists } = ARTIST_NAME
    ? await q.eq('name', ARTIST_NAME).limit(1)
    : await q.order('name').limit(1);
  const artist = artists?.[0];
  if (!artist) {
    console.error('No matching artist found.');
    process.exit(1);
  }

  const app_metadata = { ...(creator.app_metadata ?? {}), role: 'creator', artist_id: artist.id };
  const { error } = await admin.auth.admin.updateUserById(creator.id, { app_metadata });
  if (error) throw error;
  console.log(`Linked ${CREATOR_EMAIL} (role=creator) -> artist "${artist.name}" (${artist.id})`);
}

main().catch((e) => {
  console.error('Failed:', e.message ?? e);
  process.exit(1);
});
