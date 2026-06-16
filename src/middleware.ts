import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServer } from './lib/supabase/server';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const CREATOR_ROLES = new Set<App.Role>(['creator', 'contributor']);

function isPublicCacheable(pathname: string): boolean {
  if (pathname.startsWith('/admin')) return false;
  if (pathname.startsWith('/studio')) return false;
  if (pathname.startsWith('/api')) return false;
  if (pathname.startsWith('/_')) return false;
  return true;
}

function resolveRole(appMetadata: Record<string, unknown> | undefined): App.Role {
  const r = appMetadata?.role;
  if (r === 'creator' || r === 'contributor' || r === 'super_admin') return r;
  // Unset role defaults to the gallery owner (super_admin). Artists must be
  // given 'creator'/'contributor' explicitly, which is what gates them into
  // /studio and out of nothing else.
  return 'super_admin';
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // CSRF: host-only Origin check on writes to privileged surfaces
  if (
    WRITE_METHODS.has(context.request.method) &&
    (pathname.startsWith('/admin') || pathname.startsWith('/studio') || pathname.startsWith('/_actions') || pathname.startsWith('/api'))
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

  // Resolve session for all requests (never throw — missing env = logged out)
  try {
    const supabase = createSupabaseServer(context.cookies, context.request.headers);
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      context.locals.user = {
        id: data.user.id,
        email: data.user.email ?? '',
        role: resolveRole(data.user.app_metadata as Record<string, unknown> | undefined),
      };
    }
  } catch {
    /* logged out / unconfigured */
  }

  const user = context.locals.user;
  const isAdmin = pathname.startsWith('/admin');
  const isStudio = pathname.startsWith('/studio');

  // Admin (gallery-owner CMS) — any authenticated user; login page is public.
  if (pathname === '/admin/login') {
    // allow
  } else if (isAdmin && !user) {
    return context.redirect('/admin/login', 302);
  }

  // Studio (artist design tool) — creator/contributor roles ONLY. Gallery
  // owners (super_admin) are intentionally kept out.
  if (isStudio) {
    if (!user) return context.redirect('/admin/login', 302);
    if (!CREATOR_ROLES.has(user.role)) return context.redirect('/admin', 302);
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
