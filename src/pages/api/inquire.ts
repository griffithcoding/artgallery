import type { APIRoute } from 'astro';
import { createSupabaseAdmin } from '../../lib/supabase/server';
import {
  validateInquiry, isHoneypotTripped, isRateLimited, rowToInquiry,
  RATE_LIMIT_WINDOW_MS, type InquirySource,
} from '../../lib/inquiries';
import { notifyNewInquiry, sendAutoresponder } from '../../lib/email';

export const prerender = false;

function clientIp(headers: Headers): string {
  return (headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
}

export const POST: APIRoute = async ({ request }) => {
  // Accept JSON (fetch) or form-encoded (no-JS fallback).
  let body: Record<string, string> = {};
  const ct = request.headers.get('content-type') ?? '';
  try {
    if (ct.includes('application/json')) {
      body = await request.json();
    } else {
      const f = await request.formData();
      body = Object.fromEntries([...f.entries()].map(([k, v]) => [k, String(v)]));
    }
  } catch {
    return Response.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
  }

  // Honeypot: respond success but store nothing (give bots no signal).
  if (isHoneypotTripped({ honeypot: body.company })) {
    return Response.json({ ok: true });
  }

  const consent = body.consent === 'on' || body.consent === 'true';
  const v = validateInquiry({
    name: body.name, email: body.email, message: body.message, phone: body.phone,
    consent,
    artworkId: body.artwork_id || null,
    artworkTitle: body.artwork_title || '',
    source: (body.source === 'artwork' ? 'artwork' : 'contact') as InquirySource,
  });
  if (!v.ok) return Response.json({ ok: false, field: v.field, error: v.error }, { status: 400 });

  const admin = createSupabaseAdmin();
  const ip = clientIp(request.headers);

  // Best-effort rate-limit: count this IP's inserts in the window.
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count } = await admin
    .from('inquiries')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .gte('created_at', since);
  if (isRateLimited(count ?? 0)) {
    return Response.json({ ok: false, error: 'Too many requests — please try again shortly.' }, { status: 429 });
  }

  const { data, error } = await admin
    .from('inquiries')
    .insert({
      artwork_id: v.value.artworkId ?? null,
      artwork_title: v.value.artworkTitle ?? '',
      name: v.value.name,
      email: v.value.email,
      phone: v.value.phone ?? '',
      message: v.value.message,
      source: v.value.source ?? 'contact',
      consent_marketing: consent,
      consent_ts: consent ? new Date().toISOString() : null,
      ip,
    })
    .select('*')
    .single();

  if (error || !data) {
    return Response.json({ ok: false, error: 'Could not submit — please try again.' }, { status: 500 });
  }

  // Notifications are dormant unless RESEND_API_KEY is set; never block the response.
  const inquiry = rowToInquiry(data);
  const origin = new URL(request.url).origin;
  try {
    await Promise.allSettled([notifyNewInquiry(inquiry, origin), sendAutoresponder(inquiry)]);
  } catch { /* ignore */ }

  return Response.json({ ok: true });
};
