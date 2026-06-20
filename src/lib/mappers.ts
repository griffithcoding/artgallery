import { artSVG } from './data';
import type { Artwork, Artist, Exhibition } from './gallery';
import type { ArtworkRow, ArtistRow, ExhibitionRow } from './supabase/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Parse a 'YYYY-MM-DD' date by string parts (no Date object → no timezone skew).
function parseDate(d: string | null): { y: number; m: number; day: number } | null {
  if (!d) return null;
  const [y, m, day] = d.split('-').map(Number);
  if (!y || !m || !day) return null;
  return { y, m, day };
}
function monthDay(p: { m: number; day: number }): string {
  return `${MONTHS[p.m - 1]} ${p.day}`;
}

// "May 22 – Jul 12, 2026" / "Dec 18, 2025 – Jan 24, 2026" / "May 22, 2026" / ''
export function formatDateRange(start: string | null, end: string | null): string {
  const s = parseDate(start);
  const e = parseDate(end);
  if (s && e) {
    return s.y === e.y
      ? `${monthDay(s)} – ${monthDay(e)}, ${e.y}`
      : `${monthDay(s)}, ${s.y} – ${monthDay(e)}, ${e.y}`;
  }
  if (s) return `${monthDay(s)}, ${s.y}`;
  if (e) return `${monthDay(e)}, ${e.y}`;
  return '';
}

export function exhibitionYear(start: string | null, end: string | null): number {
  return parseDate(end)?.y ?? parseDate(start)?.y ?? 0;
}

export function rowToExhibition(r: ExhibitionRow, artistIds: string[]): Exhibition {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    subtitle: r.subtitle,
    status: r.status,
    dates: formatDateRange(r.start_date, r.end_date),
    year: exhibitionYear(r.start_date, r.end_date),
    artistIds,
    blurb: r.blurb,
    description: r.description || undefined,
    heroImage: r.hero_image_url || undefined,
  };
}

type ArtistRef = { id: string; slug: string; name: string } | null;

export function rowToArtwork(r: ArtworkRow, artist: ArtistRef): Artwork {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    artistId: r.artist_id ?? '',
    artistName: artist?.name ?? 'Unknown artist',
    artistSlug: artist?.slug ?? '',
    year: r.year ?? 0,
    medium: r.medium,
    category: r.category,
    subject: r.subject,
    dimensions: r.dimensions,
    ratio: r.ratio,
    availability: r.availability,
    image: r.image_url ?? artSVG(r.id, r.ratio),
  };
}

export function rowToArtist(r: ArtistRow): Artist {
  const birth = [r.birthplace, r.birth_year].filter(Boolean).join(', ');
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    birth,
    discipline: r.discipline,
    bio: r.bio,
    representedSince: r.represented_since ?? undefined,
    activeSince: r.active_since ?? undefined,
    basedIn: r.based_in ?? '',
    websiteUrl: r.website_url ?? '',
    instagramUrl: r.instagram_url ?? '',
    education: r.education ?? '',
    nationality: r.nationality ?? '',
    cvUrl: r.cv_url ?? '',
    featured: r.featured ?? false,
  };
}
