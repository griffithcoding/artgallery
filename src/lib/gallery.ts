/* =========================================================================
   Mazlish + Wright Contemporary — Data-access seam
   The whole public site reads gallery data through this module.

   DUAL-MODE: when Supabase is configured (env vars present) artworks + artists
   come from the database; otherwise they fall back to the in-repo generator so
   the public site renders even before the gallery owner provisions Supabase. On
   any DB error the generator is used too, so the live site never breaks.

   Exhibitions / fairs / press stay on the generator until their own CMS plan;
   getArtistById() therefore also stays on the generator (it resolves the
   generator-exhibition artist ids).
   ========================================================================= */
import {
  artists as _artists,
  artworks as _artworks,
  exhibitions as _exhibitions,
  fairs as _fairs,
  press as _press,
  artSVG,
  CATEGORIES_LIST,
  SUBJECTS_LIST,
} from './data';
import { createSupabaseAnon, isSupabaseConfigured } from './supabase/server';
import { rowToArtwork, rowToArtist, rowToExhibition } from './mappers';
import type { ArtworkRow, ArtistRow, ExhibitionRow } from './supabase/types';

export interface Artist {
  id: string;
  slug: string;
  name: string;
  birth: string;
  discipline: string;
  bio: string;
  representedSince?: number;
  activeSince?: number;
  basedIn?: string;
  websiteUrl?: string;
  instagramUrl?: string;
  education?: string;
  nationality?: string;
  cvUrl?: string;
  featured?: boolean;
}
export interface Artwork {
  id: string;
  slug: string;
  title: string;
  artistId: string;
  artistName: string;
  artistSlug: string;
  year: number;
  medium: string;
  category: string;
  subject: string;
  dimensions: string;
  ratio: string;
  availability: 'Available' | 'Inquire' | 'Sold';
  image: string;
}
export interface Exhibition {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  status: 'On View' | 'Upcoming' | 'Past';
  dates: string;
  year: number;
  artistIds: string[];
  blurb: string;
  description?: string;
  heroImage?: string;
}
export interface Fair {
  name: string;
  city: string;
  booth: string;
  dates: string;
  status: string;
}
export interface PressItem {
  outlet: string;
  headline: string;
  date: string;
  kind: string;
}

const ARTWORK_SELECT = '*, artist:artists(id, slug, name)';

// ---- Artworks (dual-mode) ----
export async function getArtworks(): Promise<Artwork[]> {
  if (!isSupabaseConfigured()) return _artworks;
  try {
    const sb = createSupabaseAnon();
    const { data, error } = await sb
      .from('artworks')
      .select(ARTWORK_SELECT)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r: any) => rowToArtwork(r as ArtworkRow, r.artist ?? null));
  } catch {
    return _artworks;
  }
}

export async function getArtwork(slug: string): Promise<Artwork | undefined> {
  if (!isSupabaseConfigured()) return _artworks.find((w) => w.slug === slug);
  try {
    const sb = createSupabaseAnon();
    const { data, error } = await sb.from('artworks').select(ARTWORK_SELECT).eq('slug', slug).maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    return rowToArtwork(data as any as ArtworkRow, (data as any).artist ?? null);
  } catch {
    return _artworks.find((w) => w.slug === slug);
  }
}

export async function getWorksByArtist(artistId: string): Promise<Artwork[]> {
  if (!isSupabaseConfigured()) return _artworks.filter((w) => w.artistId === artistId);
  try {
    const sb = createSupabaseAnon();
    const { data, error } = await sb
      .from('artworks')
      .select(ARTWORK_SELECT)
      .eq('artist_id', artistId)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r: any) => rowToArtwork(r as ArtworkRow, r.artist ?? null));
  } catch {
    return _artworks.filter((w) => w.artistId === artistId);
  }
}

export async function getFeaturedArtworks(limit = 8): Promise<Artwork[]> {
  if (!isSupabaseConfigured()) return _artworks.slice(0, limit);
  try {
    const sb = createSupabaseAnon();
    const { data, error } = await sb
      .from('artworks')
      .select(ARTWORK_SELECT)
      .eq('featured', true)
      .order('sort_order', { ascending: true })
      .limit(limit);
    if (error) throw error;
    const rows = data ?? [];
    if (rows.length) return rows.map((r: any) => rowToArtwork(r as ArtworkRow, r.artist ?? null));
    // No featured works flagged yet → fall back to the newest works.
    return (await getArtworks()).slice(0, limit);
  } catch {
    return _artworks.slice(0, limit);
  }
}

// ---- Artists (dual-mode) ----
export async function getArtists(): Promise<Artist[]> {
  if (!isSupabaseConfigured()) return _artists;
  try {
    const sb = createSupabaseAnon();
    const { data, error } = await sb
      .from('artists')
      .select('*')
      .order('featured', { ascending: false })
      .order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => rowToArtist(r as ArtistRow));
  } catch {
    return _artists;
  }
}

export async function getArtist(slug: string): Promise<Artist | undefined> {
  if (!isSupabaseConfigured()) return _artists.find((a) => a.slug === slug);
  try {
    const sb = createSupabaseAnon();
    const { data, error } = await sb.from('artists').select('*').eq('slug', slug).maybeSingle();
    if (error) throw error;
    return data ? rowToArtist(data as ArtistRow) : undefined;
  } catch {
    return _artists.find((a) => a.slug === slug);
  }
}

// Dual-mode by id. DB-backed exhibitions reference Supabase artist UUIDs; the
// generator-fallback exhibitions reference 'a0'-style ids. Querying a uuid column
// with a non-uuid id errors → caught → resolved from the generator. Both work.
export async function getArtistById(id: string): Promise<Artist | undefined> {
  if (isSupabaseConfigured()) {
    try {
      const sb = createSupabaseAnon();
      const { data, error } = await sb.from('artists').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (data) return rowToArtist(data as ArtistRow);
    } catch {
      /* fall through to generator */
    }
  }
  return _artists.find((a) => a.id === id);
}

// Per-artist artwork counts for the admin list + public credentials. Dual-mode.
export async function getArtistWorkCounts(): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  const tally = (rows: Array<{ artistId?: string; artist_id?: string }>) => {
    for (const r of rows) {
      const id = (r as { artistId?: string }).artistId ?? (r as { artist_id?: string }).artist_id;
      if (id) m.set(id, (m.get(id) ?? 0) + 1);
    }
  };
  if (!isSupabaseConfigured()) { tally(_artworks as Array<{ artistId?: string }>); return m; }
  try {
    const sb = createSupabaseAnon();
    const { data, error } = await sb.from('artworks').select('artist_id');
    if (error) throw error;
    tally((data ?? []) as Array<{ artist_id?: string }>);
    return m;
  } catch {
    tally(_artworks as Array<{ artistId?: string }>);
    return m;
  }
}

// ---- Exhibitions (dual-mode) ----
// When Supabase is configured and the table has rows, exhibitions come from the DB
// (joined to exhibition_artists). When the table is empty or on any error, the
// generator data is used so the public page is never blank pre-population.
const EXHIBITION_SELECT = '*, exhibition_artists(artist_id)';

function joinArtistIds(row: any): string[] {
  return ((row.exhibition_artists ?? []) as Array<{ artist_id: string }>)
    .map((j) => j.artist_id)
    .filter(Boolean);
}

export async function getExhibitions(): Promise<Exhibition[]> {
  if (!isSupabaseConfigured()) return _exhibitions;
  try {
    const sb = createSupabaseAnon();
    const { data, error } = await sb
      .from('exhibitions')
      .select(EXHIBITION_SELECT)
      .order('sort_order', { ascending: true })
      .order('start_date', { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    if (!rows.length) return _exhibitions;
    return rows.map((r: any) => rowToExhibition(r as ExhibitionRow, joinArtistIds(r)));
  } catch {
    return _exhibitions;
  }
}

export async function getExhibition(slug: string): Promise<Exhibition | undefined> {
  if (!isSupabaseConfigured()) return _exhibitions.find((e) => e.slug === slug);
  try {
    const sb = createSupabaseAnon();
    const { data, error } = await sb
      .from('exhibitions')
      .select(EXHIBITION_SELECT)
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw error;
    if (data) return rowToExhibition(data as any as ExhibitionRow, joinArtistIds(data));
  } catch {
    /* fall through to generator */
  }
  return _exhibitions.find((e) => e.slug === slug);
}
export async function getFairs(): Promise<Fair[]> {
  return _fairs;
}
export async function getPress(): Promise<PressItem[]> {
  return _press;
}

export const categories = CATEGORIES_LIST;
export const subjects = SUBJECTS_LIST;
export { artSVG };
