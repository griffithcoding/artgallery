/* =========================================================================
   VERSO — Data-access seam
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
import { rowToArtwork, rowToArtist } from './mappers';
import type { ArtworkRow, ArtistRow } from './supabase/types';

export interface Artist {
  id: string;
  slug: string;
  name: string;
  birth: string;
  discipline: string;
  bio: string;
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
    const { data, error } = await sb.from('artists').select('*').order('name', { ascending: true });
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

// Generator-only: resolves generator-exhibition artist ids (exhibitions are not
// in Supabase yet). Moves to Supabase when the exhibitions CMS plan lands.
export async function getArtistById(id: string): Promise<Artist | undefined> {
  return _artists.find((a) => a.id === id);
}

// ---- Exhibitions / fairs / press (generator until their own plan) ----
export async function getExhibitions(): Promise<Exhibition[]> {
  return _exhibitions;
}
export async function getExhibition(slug: string): Promise<Exhibition | undefined> {
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
