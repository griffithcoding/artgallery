/* =========================================================================
   VERSO — Data-access seam
   The whole public site reads gallery data through this module. Today it is
   backed by the ported in-repo generator (./data); the Artwork CMS plan
   replaces the bodies with Supabase queries WITHOUT changing these signatures.
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

export async function getArtworks(): Promise<Artwork[]> {
  return _artworks;
}
export async function getArtwork(slug: string): Promise<Artwork | undefined> {
  return _artworks.find((w) => w.slug === slug);
}
export async function getArtists(): Promise<Artist[]> {
  return _artists;
}
export async function getArtist(slug: string): Promise<Artist | undefined> {
  return _artists.find((a) => a.slug === slug);
}
export async function getArtistById(id: string): Promise<Artist | undefined> {
  return _artists.find((a) => a.id === id);
}
export async function getWorksByArtist(artistId: string): Promise<Artwork[]> {
  return _artworks.filter((w) => w.artistId === artistId);
}
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
