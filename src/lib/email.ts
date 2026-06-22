import { BRAND } from './site';
import type { Inquiry } from './inquiries';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
// Sending address — requires a domain verified in Resend before email goes live.
const FROM = 'Mazlish + Wright <noreply@mazlishwrightcontemporary.com>';

function resendKey(): string {
  const fromBuild = (import.meta.env as Record<string, string | undefined>)['RESEND_API_KEY'];
  const fromRuntime =
    typeof process !== 'undefined' && process.env ? process.env.RESEND_API_KEY : undefined;
  return fromBuild ?? fromRuntime ?? '';
}

export function emailConfigured(): boolean {
  return Boolean(resendKey());
}

async function send(payload: { to: string[]; subject: string; text: string }): Promise<boolean> {
  const key = resendKey();
  if (!key) return false; // dormant
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, ...payload }),
    });
    return res.ok;
  } catch {
    return false; // never let a provider outage break capture
  }
}

export async function notifyNewInquiry(inq: Inquiry, baseUrl: string): Promise<boolean> {
  const contact = `${inq.name} <${inq.email}>${inq.phone ? ' · ' + inq.phone : ''}`;
  return send({
    to: [BRAND.email],
    subject: `New inquiry — ${inq.artworkTitle || inq.name}`,
    text: `${contact}\nWork: ${inq.artworkTitle || '—'}\n\n${inq.message}\n\nManage: ${baseUrl}/admin/inquiries/${inq.id}`,
  });
}

export async function sendAutoresponder(inq: Inquiry): Promise<boolean> {
  return send({
    to: [inq.email],
    subject: 'We received your inquiry — Mazlish + Wright Contemporary',
    text: `Dear ${inq.name},\n\nThank you for your inquiry${inq.artworkTitle ? ` regarding ${inq.artworkTitle}` : ''}. A gallery representative will reply within one business day.\n\nMazlish + Wright Contemporary`,
  });
}
