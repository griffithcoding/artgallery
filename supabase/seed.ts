/**
 * One-time seed: imports the in-repo demo artists + artworks into Supabase so a
 * fresh project launches populated. Idempotent (upsert on slug). Images are left
 * null so the app renders its generated SVG placeholder — swap in real images via
 * the admin CMS at your pace.
 *
 * Run:  node --import tsx supabase/seed.ts        (reads .env automatically)
 * Needs: PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env
 */
import { createClient } from '@supabase/supabase-js';
import { artists as genArtists, artworks as genArtworks } from '../src/lib/data';

try {
  (process as any).loadEnvFile?.('.env');
} catch {
  /* env already present */
}

const URL = process.env.PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

function parseBirth(birth: string): { birthplace: string; birth_year: number | null } {
  const m = birth.match(/^(.*?),\s*(\d{4})$/);
  if (m) return { birthplace: m[1].trim(), birth_year: Number(m[2]) };
  return { birthplace: birth, birth_year: null };
}

const idMap: Record<string, string> = {};
let aOk = 0;
for (const a of genArtists) {
  const { birthplace, birth_year } = parseBirth(a.birth);
  const { data, error } = await sb
    .from('artists')
    .upsert(
      { slug: a.slug, name: a.name, birthplace, birth_year, discipline: a.discipline, bio: a.bio },
      { onConflict: 'slug' }
    )
    .select('id')
    .single();
  if (error) {
    console.error('artist', a.slug, error.message);
    continue;
  }
  idMap[a.id] = data.id;
  aOk++;
}

let wOk = 0;
for (let i = 0; i < genArtworks.length; i++) {
  const w = genArtworks[i];
  const { error } = await sb.from('artworks').upsert(
    {
      slug: w.slug,
      title: w.title,
      artist_id: idMap[w.artistId] ?? null,
      year: w.year,
      medium: w.medium,
      category: w.category,
      subject: w.subject,
      dimensions: w.dimensions,
      ratio: w.ratio,
      availability: w.availability,
      image_url: null,
      featured: i < 8,
      sort_order: i,
    },
    { onConflict: 'slug' }
  );
  if (error) {
    console.error('artwork', w.slug, error.message);
    continue;
  }
  wOk++;
}

console.log(`Seeded ${aOk}/${genArtists.length} artists, ${wOk}/${genArtworks.length} artworks.`);
