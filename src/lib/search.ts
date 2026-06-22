// src/lib/search.ts
// Pure cross-module admin search. The page fetches the datasets; this filters.
export type SearchKind = 'artwork' | 'artist' | 'exhibition' | 'fair' | 'inquiry';
export interface SearchHit { kind: SearchKind; title: string; subtitle: string; href: string; }
export interface SearchGroup { kind: SearchKind; label: string; hits: SearchHit[]; }

export interface SearchDatasets {
  artworks: Array<{ id: string; title: string; medium: string; year: number; artistName: string }>;
  artists: Array<{ id: string; name: string; discipline: string }>;
  exhibitions: Array<{ id: string; title: string; subtitle: string }>;
  fairs: Array<{ id: string; name: string; city: string }>;
  inquiries: Array<{ id: string; name: string; email: string; message: string }>;
}

const has = (q: string, ...fields: Array<string | number>) =>
  fields.some((f) => String(f ?? '').toLowerCase().includes(q));

export function searchAdmin(query: string, d: SearchDatasets): SearchGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const groups: SearchGroup[] = [];

  const artworks = d.artworks.filter((w) => has(q, w.title, w.medium, w.year, w.artistName))
    .map((w): SearchHit => ({ kind: 'artwork', title: w.title, subtitle: `${w.artistName} · ${w.year || ''}`.trim(), href: `/admin/artworks/${w.id}` }));
  if (artworks.length) groups.push({ kind: 'artwork', label: 'Artworks', hits: artworks });

  const artists = d.artists.filter((a) => has(q, a.name, a.discipline))
    .map((a): SearchHit => ({ kind: 'artist', title: a.name, subtitle: a.discipline, href: `/admin/artists/${a.id}` }));
  if (artists.length) groups.push({ kind: 'artist', label: 'Artists', hits: artists });

  const exhibitions = d.exhibitions.filter((e) => has(q, e.title, e.subtitle))
    .map((e): SearchHit => ({ kind: 'exhibition', title: e.title, subtitle: e.subtitle, href: `/admin/exhibitions/${e.id}` }));
  if (exhibitions.length) groups.push({ kind: 'exhibition', label: 'Exhibitions', hits: exhibitions });

  const fairs = d.fairs.filter((f) => has(q, f.name, f.city))
    .map((f): SearchHit => ({ kind: 'fair', title: f.name, subtitle: f.city, href: `/admin/fairs/${f.id}` }));
  if (fairs.length) groups.push({ kind: 'fair', label: 'Art Fairs', hits: fairs });

  const inquiries = d.inquiries.filter((i) => has(q, i.name, i.email, i.message))
    .map((i): SearchHit => ({ kind: 'inquiry', title: i.name, subtitle: i.email, href: `/admin/inquiries/${i.id}` }));
  if (inquiries.length) groups.push({ kind: 'inquiry', label: 'Inquiries', hits: inquiries });

  return groups;
}
