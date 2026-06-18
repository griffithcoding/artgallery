// Admin utility: list auth users with email + role (service role). Read-only.
// Run: npx -y tsx supabase/list-users.ts  (reads .env)
import { createClient } from '@supabase/supabase-js';

process.loadEnvFile();
const admin = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  for (const u of data.users) {
    const role = (u.app_metadata as any)?.role ?? '(unset → super_admin)';
    const artistId = (u.app_metadata as any)?.artist_id ?? '';
    console.log(`${u.email}\trole=${role}\tartist_id=${artistId}\tlast_sign_in=${u.last_sign_in_at ?? 'never'}`);
  }
}
main().catch((e) => { console.error('Failed:', e.message ?? e); process.exit(1); });
