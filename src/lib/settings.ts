// src/lib/settings.ts
// Owner-editable contact/hours. Dual-mode: DB row merged over BRAND defaults;
// falls back to BRAND when Supabase is unconfigured or on any error.
import { BRAND } from './site';
import { createSupabaseAnon, isSupabaseConfigured } from './supabase/server';

export interface SiteSettings {
  email: string; phone: string; hours: string;
  addressLine: string; addressCity: string; instagramUrl: string;
}

export interface SiteSettingsRow {
  email: string; phone: string; hours: string;
  address_line: string; address_city: string; instagram_url: string;
}

export function getDefaults(): SiteSettings {
  return {
    email: BRAND.email,
    phone: BRAND.phone,
    hours: BRAND.hours,
    addressLine: BRAND.addressLine,
    addressCity: BRAND.addressCity,
    instagramUrl: BRAND.instagram,
  };
}

export function mergeSettings(row: Partial<SiteSettingsRow> | null): SiteSettings {
  const d = getDefaults();
  if (!row) return d;
  const pick = (v: string | undefined, fallback: string) => (v && v.trim() ? v : fallback);
  return {
    email: pick(row.email, d.email),
    phone: pick(row.phone, d.phone),
    hours: pick(row.hours, d.hours),
    addressLine: pick(row.address_line, d.addressLine),
    addressCity: pick(row.address_city, d.addressCity),
    instagramUrl: pick(row.instagram_url, d.instagramUrl),
  };
}

export async function getSettings(): Promise<SiteSettings> {
  if (!isSupabaseConfigured()) return getDefaults();
  try {
    const sb = createSupabaseAnon();
    const { data, error } = await sb.from('site_settings').select('*').eq('id', 1).maybeSingle();
    if (error) throw error;
    return mergeSettings(data as SiteSettingsRow | null);
  } catch {
    return getDefaults();
  }
}
