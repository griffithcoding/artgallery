import { createServerClient, parseCookieHeader, type CookieOptionsWithName } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';

// Vite inlines `import.meta.env.*` at BUILD time. On Vercel, env vars scoped to
// the build are inlined; vars available only at runtime arrive via process.env.
// Read both so the SSR functions work regardless of which scope is set.
function readEnv(key: string): string {
  const fromBuild = (import.meta.env as Record<string, string | undefined>)[key];
  const fromRuntime =
    typeof process !== 'undefined' && process.env ? process.env[key] : undefined;
  return fromBuild ?? fromRuntime ?? '';
}

const URL = readEnv('PUBLIC_SUPABASE_URL');
const ANON = readEnv('PUBLIC_SUPABASE_ANON_KEY');
const SERVICE = readEnv('SUPABASE_SERVICE_ROLE_KEY');

const cookieOpts: CookieOptionsWithName = {
  name: 'sb',
  path: '/',
  sameSite: 'lax',
  httpOnly: true,
  secure: import.meta.env.PROD,
};

/**
 * Cookie-aware client for the logged-in session (anon key, RLS-limited).
 * Astro's AstroCookies has no getAll(), so incoming cookies are read from the
 * request's Cookie header; outgoing cookies are written via cookies.set().
 */
export function createSupabaseServer(cookies: AstroCookies, headers: Headers) {
  return createServerClient(URL, ANON, {
    cookieOptions: cookieOpts,
    cookies: {
      getAll: () =>
        parseCookieHeader(headers.get('cookie') ?? '').map((c) => ({
          name: c.name,
          value: c.value ?? '',
        })),
      setAll: (toSet) =>
        toSet.forEach(({ name, value, options }) =>
          cookies.set(name, value, options)),
    },
  });
}

/** Service-role client — SERVER ONLY. Bypasses RLS for admin writes. */
export function createSupabaseAdmin() {
  return createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Context-free anon client for public reads (RLS-limited SELECTs). */
export function createSupabaseAnon() {
  return createClient(URL, ANON, { auth: { persistSession: false } });
}

/**
 * True only when Supabase is provisioned (URL + anon key present). The data
 * seam uses this to stay on the in-repo generator until the gallery owner
 * sets the env vars — so the public site never breaks pre-provision.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(URL && ANON);
}
