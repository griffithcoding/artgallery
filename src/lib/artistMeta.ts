// Pure helpers for artist credential display. No I/O — unit-tested.
export function yearsActive(activeSince?: number | null, currentYear = new Date().getFullYear()): number | null {
  if (!activeSince) return null;
  return Math.max(0, currentYear - activeSince);
}

export function normalizeUrl(u?: string | null): string | null {
  const s = (u ?? '').trim();
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

export function instagramUrl(v?: string | null): string | null {
  const s = (v ?? '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://instagram.com/${s.replace(/^@/, '')}`;
}
