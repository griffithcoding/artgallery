import type { APIRoute } from 'astro';
import { createSupabaseServer } from '../../lib/supabase/server';

export const prerender = false;

export const ALL: APIRoute = async ({ cookies, request, redirect }) => {
  try {
    const supabase = createSupabaseServer(cookies, request.headers);
    await supabase.auth.signOut();
  } catch {
    /* unconfigured — nothing to sign out */
  }
  return redirect('/admin/login', 303);
};
