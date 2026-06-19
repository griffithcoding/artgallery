import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServer } from './lib/supabase/server';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isPublicCacheable(pathname: string): boolean {
  if (pathname.startsWith('/admin')) return false;
  if (pathname.startsWith('/api')) return false;
  if (pathname.startsWith('/_')) return false;
  return true;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // CSRF: host-only Origin check on writes to privileged surfaces
  if (
    WRITE_METHODS.has(context.request.method) &&
    (pathname.startsWith('/admin') || pathname.startsWith('/_actions') || pathname.startsWith('/api'))
  ) {
    const origin = context.request.headers.get('origin');
    const host = context.request.headers.get('host');
    if (origin && host) {
      try {
        if (new URL(origin).host !== host) {
          return new Response('Cross-site request blocked', { status: 403 });
        }
      } catch {
        return new Response('Invalid origin', { status: 403 });
      }
    }
  }

  // Resolve session for all requests (never throw — missing env = logged out).
  // Anyone who can sign in is the gallery owner; there is a single admin role.
  try {
    const supabase = createSupabaseServer(context.cookies, context.request.headers);
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      context.locals.user = {
        id: data.user.id,
        email: data.user.email ?? '',
        role: 'super_admin',
      };
    }
  } catch {
    /* logged out / unconfigured */
  }

  const user = context.locals.user;
  const isAdmin = pathname.startsWith('/admin');

  // Admin (gallery CMS) — any signed-in user is the gallery owner. The login
  // page itself is public.
  if (pathname === '/admin/login') {
    // allow
  } else if (isAdmin) {
    if (!user) return context.redirect('/admin/login', 302);
  }

  const res = await next();

  if (context.request.method === 'GET' && isPublicCacheable(pathname)) {
    res.headers.set(
      'Cache-Control',
      context.locals.user
        ? 'private, no-store'
        : 'public, s-maxage=60, stale-while-revalidate=86400'
    );
  }
  return res;
});
