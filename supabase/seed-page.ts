// One-off: insert/refresh the 'studio-demo' composer page.
// Run: npx -y tsx supabase/seed-page.ts   (reads .env)
import { createClient } from '@supabase/supabase-js';
process.loadEnvFile();
const sb = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// Pull a few real artwork ids for the works grid.
const { data: works } = await sb.from('artworks').select('id').limit(3);
const workIds = (works ?? []).map((w) => w.id);

const blocks = [
  { id: 'hero-1', type: 'hero', props: { heading: 'Studio Demo', sub: 'A page built with the composer', imageUrl: '' } },
  { id: 'head-1', type: 'heading', props: { text: 'About this page', level: 2 } },
  { id: 'rt-1', type: 'richText', props: { html: '<p>This page is rendered entirely from editable blocks. Toggle Content mode to change this text in place.</p>' } },
  { id: 'img-1', type: 'image', props: { url: '', alt: '', caption: 'Click to swap this image' } },
  { id: 'grid-1', type: 'worksGrid', props: { workIds, cols: 3 } },
  { id: 'quote-1', type: 'quote', props: { text: 'Design is intelligence made visible.', cite: '— Alina Wheeler' } },
  { id: 'sp-1', type: 'spacer', props: { size: 'lg' } },
];

const row = { slug: 'studio-demo', title: 'Studio Demo', status: 'published', blocks, published_blocks: blocks };
const { error } = await sb.from('pages').upsert(row, { onConflict: 'slug' });
if (error) { console.error('seed failed:', error.message); process.exit(1); }
console.log('Seeded /p/studio-demo (editor: /admin/pages/studio-demo)');
