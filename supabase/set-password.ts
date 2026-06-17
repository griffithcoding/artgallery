// Admin utility: set a user's password by email (service role). No secrets in
// code — pass EMAIL and PASSWORD as env vars.
// Run: EMAIL=user@example.com PASSWORD='…' npx -y tsx supabase/set-password.ts
import { createClient } from '@supabase/supabase-js';

process.loadEnvFile();
const admin = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error('Set EMAIL and PASSWORD env vars.');
  process.exit(1);
}

async function main() {
  let target: { id: string } | undefined;
  for (let page = 1; page <= 25 && !target; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    target = data.users.find((u) => u.email === EMAIL) as typeof target;
    if (data.users.length < 200) break;
  }
  if (!target) { console.error(`User not found: ${EMAIL}`); process.exit(1); }
  const { error } = await admin.auth.admin.updateUserById(target.id, { password: PASSWORD });
  if (error) throw error;
  console.log(`Password updated for ${EMAIL}`);
}

main().catch((e) => { console.error('Failed:', e.message ?? e); process.exit(1); });
