// DB row types — match supabase/schema.sql. Used by the Artwork CMS plan when
// the gallery seam swaps to Supabase queries.
export interface ArtworkRow {
  id: string; slug: string; title: string; artist_id: string | null;
  year: number | null; medium: string; category: string; subject: string;
  dimensions: string; ratio: string;
  availability: 'Available' | 'Inquire' | 'Sold';
  image_url: string | null; featured: boolean; sort_order: number;
  created_at: string; updated_at: string;
}
export interface ArtistRow {
  id: string; slug: string; name: string; birthplace: string;
  birth_year: number | null; discipline: string; bio: string;
  portrait_image_url: string | null;
  represented_since: number | null; active_since: number | null;
  based_in: string; website_url: string; instagram_url: string;
  education: string; nationality: string; cv_url: string; featured: boolean;
  created_at: string; updated_at: string;
}
export interface ExhibitionRow {
  id: string; slug: string; title: string; subtitle: string;
  status: 'On View' | 'Upcoming' | 'Past';
  start_date: string | null; end_date: string | null; blurb: string;
  sort_order: number; created_at: string; updated_at: string;
}
export interface FairRow { id: string; name: string; city: string; booth: string; dates: string; status: string; sort_order: number; created_at: string; updated_at: string; }
export interface ViewingRoomRow { id: string; slug: string; title: string; description: string; sort_order: number; created_at: string; updated_at: string; }
export interface InquiryRow { id: string; artwork_id: string | null; artwork_title: string; name: string; email: string; message: string; status: 'new' | 'replied' | 'archived'; source: 'artwork' | 'contact'; created_at: string; }
export interface PostRow { id: string; slug: string; title: string; description: string; body: string; cover_image_url: string | null; status: 'draft' | 'published'; category: 'Journal' | 'Press' | 'Exhibitions'; published_at: string | null; created_at: string; updated_at: string; }
export interface PressMentionRow { id: string; outlet: string; headline: string; url: string; date: string; kind: 'Review' | 'Feature' | 'Listing' | 'Profile'; sort_order: number; created_at: string; updated_at: string; }
export interface PageRow {
  id: string; slug: string; title: string;
  status: 'draft' | 'published';
  blocks: unknown;            // Block[] as jsonb
  published_blocks: unknown;  // Block[] as jsonb
  updated_by: string | null; updated_at: string; created_at: string;
}
