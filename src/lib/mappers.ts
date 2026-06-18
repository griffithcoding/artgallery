import { artSVG } from './data';
import type { Artwork, Artist } from './gallery';
import type { ArtworkRow, ArtistRow } from './supabase/types';

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
