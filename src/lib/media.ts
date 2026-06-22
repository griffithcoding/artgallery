// src/lib/media.ts
// Pure media-library helpers. The page fetches storage objects + referenced URLs;
// these decide in-use vs orphan.
export interface MediaItem { path: string; url: string; inUse: boolean; }

export interface ReferenceColumns {
  artworkImages: (string | null)[];
  artistPortraits: (string | null)[];
  exhibitionHeroes: (string | null)[];
  postCovers: (string | null)[];
}

export function collectReferencedUrls(refs: ReferenceColumns): Set<string> {
  const set = new Set<string>();
  for (const col of [refs.artworkImages, refs.artistPortraits, refs.exhibitionHeroes, refs.postCovers]) {
    for (const v of col) if (v) set.add(v);
  }
  return set;
}

export function classifyObjects(
  items: Array<{ path: string; url: string }>,
  referenced: Set<string>,
  blocksText: string,
): MediaItem[] {
  return items.map((o) => ({
    ...o,
    inUse: referenced.has(o.url) || (o.url !== '' && blocksText.includes(o.url)),
  }));
}
