# VERSO Foundation (Astro Migration + Supabase + Auth) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the static VERSO gallery site to an Astro 5 SSR app that renders identically to today, behind a data-access seam, with Supabase clients, auth middleware, and an admin login shell ready for the module plans to build on.

**Architecture:** Astro 5 `output: 'server'` on the Vercel adapter (Node 22). Public pages call a data-access module (`src/lib/gallery.ts`) whose interface is fixed now and backed by the ported static generator (`src/lib/data.ts`); the Artwork CMS plan later swaps the implementation to Supabase without touching pages. Auth/session/CSRF come from a ported Supabase SSR backbone.

**Tech Stack:** Astro 5, `@astrojs/vercel`, `@astrojs/sitemap`, `@supabase/ssr`, `@supabase/supabase-js`, `sanitize-html`, TypeScript, Vitest.

**Source references:**
- Existing static pages live at repo root (`index.html`, `collection.html`, `artwork.html`, `artists.html`, `artist.html`, `exhibitions.html`, `exhibition.html`, `viewing-rooms.html`, `about.html`, `visit.html`, `contact.html`, `press.html`, `404.html`). Their `<main>` markup is the source content for the converted `.astro` pages.
- Ported-from-doula files (read the originals under `C:\Users\wgrif\Projects\TheWildBirthDoulah`): `src/lib/supabase/server.ts`, `src/middleware.ts`, `src/lib/sanitize.ts`, `src/lib/slug.ts`, `astro.config.mjs`.
- Existing JS to port: `js/main.js` (BRAND, NAV, header/footer, reveal, inquiry modal, card renderers), `js/data.js` (generator), `js/collection.js` (filter/sort/paginate).

**Conventions:** Each task ends with a commit. Run `npm run build` before any commit that changes pages or config; it must succeed. Branch is `feat/gallery-backend-portal` (already created).

---

## File structure created by this plan

```
package.json, astro.config.mjs, tsconfig.json, .gitignore   # scaffold
src/styles/styles.css            # moved from css/styles.css (unchanged)
src/styles/admin.css             # admin shell styling (VERSO dark theme)
src/layouts/Layout.astro         # public <head>/SEO/header/footer wrapper
src/layouts/AdminLayout.astro    # admin chrome + nav
src/components/Header.astro       # ported from js/main.js renderHeader
src/components/Footer.astro       # ported from js/main.js renderFooter
src/components/ArtworkCard.astro  # ported from js/main.js artworkCard
src/components/ArtistCard.astro   # ported from js/main.js artistCard
src/components/InquiryModal.astro # ported from js/main.js inquire modal
src/lib/data.ts                  # ported generator (temp data source)
src/lib/gallery.ts               # DATA-ACCESS SEAM (artworks/artists/etc.)
src/lib/site.ts                  # BRAND + NAV constants
src/lib/slug.ts                  # ported
src/lib/sanitize.ts              # ported
src/lib/supabase/server.ts       # ported (anon + service-role clients)
src/lib/supabase/types.ts        # DB row types
src/middleware.ts                # ported (session/CSRF/guard/cache)
src/env.d.ts                     # App.Locals typing
src/scripts/collection.ts        # ported filter/sort/paginate (client)
src/pages/index.astro
src/pages/works/index.astro
src/pages/works/[slug].astro
src/pages/artists/index.astro
src/pages/artists/[slug].astro
src/pages/exhibitions/index.astro
src/pages/exhibitions/[slug].astro
src/pages/viewing-rooms/index.astro
src/pages/about.astro
src/pages/visit.astro
src/pages/contact.astro
src/pages/press.astro
src/pages/404.astro
src/pages/admin/index.astro      # dashboard shell
src/pages/admin/login.astro
src/pages/admin/logout.ts
supabase/schema.sql
tests/slug.test.ts
tests/sanitize.test.ts
vitest.config.ts
.env.example
```

Files removed at the end (Task 17): root `*.html`, `js/`, `css/` (after parity confirmed).

---

## Task 1: Scaffold the Astro project

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `.gitignore`, `.env.example`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "verso-gallery",
  "type": "module",
  "version": "0.1.0",
  "engines": { "node": "22.x" },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "astro": "astro",
    "test": "vitest run"
  },
  "dependencies": {
    "@astrojs/vercel": "^8.2.11",
    "@astrojs/sitemap": "^3.4.0",
    "@supabase/ssr": "^0.10.3",
    "@supabase/supabase-js": "^2.107.0",
    "astro": "^5.0.5",
    "sanitize-html": "^2.17.4"
  },
  "devDependencies": {
    "@types/sanitize-html": "^2.16.1",
    "dotenv": "^17.4.2",
    "vitest": "^4.1.8"
  }
}
```

- [ ] **Step 2: Create `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://www.versogallery.com',
  output: 'server',
  adapter: vercel(),
  security: { checkOrigin: false }, // replaced by Origin/Host check in middleware
  integrations: [sitemap({ changefreq: 'weekly', priority: 0.7 })],
  build: { inlineStylesheets: 'auto' },
  compressHTML: true,
});
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": { "types": ["astro/client"] }
}
```

- [ ] **Step 4: Replace `.gitignore`**

```
node_modules/
dist/
.astro/
.env
.vercel/
```

- [ ] **Step 5: Create `.env.example`**

```
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 6: Install dependencies**

Run: `npm install`
Expected: dependencies install, `package-lock.json` created, no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json astro.config.mjs tsconfig.json .gitignore .env.example
git commit -m "chore: scaffold Astro project"
```

---

## Task 2: Move styles and create the public Layout

**Files:**
- Create: `src/styles/styles.css` (move from `css/styles.css`)
- Create: `src/lib/site.ts`
- Create: `src/layouts/Layout.astro`

- [ ] **Step 1: Move the stylesheet unchanged**

Run: `git mv css/styles.css src/styles/styles.css`
(Leave the rest of `css/` for now.)

- [ ] **Step 2: Create `src/lib/site.ts`** (ported from `js/main.js` BRAND + NAV; note nav hrefs are now clean routes)

```ts
export const BRAND = {
  name: 'VERSO',
  tagline: 'Contemporary Art Gallery',
  city: 'Brooklyn, New York',
  addressLine: '312 Wythe Avenue',
  addressCity: 'Brooklyn, NY 11249',
  neighborhood: 'Williamsburg',
  hours: 'Tue–Sat, 11am–6pm',
  email: 'hello@versogallery.com',
  phone: '+1 (718) 555-0142',
  instagram: 'https://www.instagram.com/',
  domain: 'https://www.versogallery.com',
} as const;

export const NAV = [
  { href: '/exhibitions', label: 'Exhibitions' },
  { href: '/artists', label: 'Artists' },
  { href: '/works', label: 'Works' },
  { href: '/viewing-rooms', label: 'Viewing Rooms' },
  { href: '/about', label: 'About' },
  { href: '/visit', label: 'Visit' },
] as const;
```

- [ ] **Step 3: Create `src/layouts/Layout.astro`**

Takes per-page SEO via props; renders the shared head, header, footer, and slot. JSON-LD passed as an optional prop string.

```astro
---
import '../styles/styles.css';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
import { BRAND } from '../lib/site';

interface Props {
  title: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  robots?: string;
  jsonLd?: object | object[];
}
const {
  title,
  description = '',
  canonical,
  ogImage = `${BRAND.domain}/images/og-cover.svg`,
  robots = 'index, follow, max-image-preview:large',
  jsonLd,
} = Astro.props;
const canonicalUrl = canonical ?? new URL(Astro.url.pathname, BRAND.domain).href;
---
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title}</title>
  {description && <meta name="description" content={description} />}
  <link rel="canonical" href={canonicalUrl} />
  <meta name="robots" content={robots} />
  <meta name="theme-color" content="#16150f" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="VERSO Gallery" />
  <meta property="og:title" content={title} />
  {description && <meta property="og:description" content={description} />}
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:image" content={ogImage} />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="icon" href="/images/favicon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  {jsonLd && <script type="application/ld+json" set:html={JSON.stringify(jsonLd)} />}
</head>
<body>
  <Header />
  <slot />
  <Footer />
</body>
</html>
```

- [ ] **Step 4: Move public static assets**

Run: `git mv images public/images` and `git mv robots.txt sitemap.xml manifest.webmanifest llms.txt llms-full.txt public/` (create `public/` first if needed: `mkdir -p public`).
Note: `sitemap.xml` will be superseded by the `@astrojs/sitemap` integration; delete the static one in Task 16. Keep `llms.txt`/`llms-full.txt` as static public files.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add public Layout, site constants, move assets"
```

---

## Task 3: Header, Footer, card, and modal components

**Files:**
- Create: `src/components/Header.astro`, `src/components/Footer.astro`, `src/components/ArtworkCard.astro`, `src/components/ArtistCard.astro`, `src/components/InquiryModal.astro`

- [ ] **Step 1: Create `src/components/Header.astro`** (ported from `js/main.js` `renderHeader`; active link via current path)

```astro
---
import { BRAND, NAV } from '../lib/site';
const path = Astro.url.pathname;
const isActive = (href: string) => href === '/' ? path === '/' : path.startsWith(href);
---
<header class="site-header">
  <div class="wrap">
    <nav class="nav" id="nav">
      <a class="brand" href="/" aria-label={`${BRAND.name} home`}>
        {BRAND.name}<small>{BRAND.city}</small>
      </a>
      <div class="nav-links">
        {NAV.map((n) => (
          <a href={n.href} aria-current={isActive(n.href) ? 'page' : undefined}>{n.label}</a>
        ))}
      </div>
      <div class="nav-actions">
        <a class="link-underline" href="/contact">Inquire</a>
        <button class="nav-toggle" id="navToggle" aria-label="Menu" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
      </div>
    </nav>
  </div>
</header>
<script>
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('nav');
  toggle?.addEventListener('click', () => {
    const open = nav?.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(!!open));
  });
</script>
```

- [ ] **Step 2: Create `src/components/Footer.astro`** (ported from `js/main.js` `renderFooter`; copy the exact footer markup from that function, replacing `.html` hrefs with clean routes and the newsletter `onsubmit` with the script below)

Use the footer inner markup from `js/main.js` lines 78–124. Replace links: `visit.html`→`/visit`, `exhibitions.html`→`/exhibitions`, `artists.html`→`/artists`, `collection.html`→`/works`, `viewing-rooms.html`→`/viewing-rooms`, `press.html`→`/press`, `contact.html`→`/contact`. Render `{new Date().getFullYear()}` for the year and `BRAND.*` values via the frontmatter import. Replace the inline `onsubmit` with:

```astro
<script>
  document.querySelector('.newsletter')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    form.innerHTML = '<span style="color:#d9d6cd;font-size:.9rem;">Thank you — you’re on the list.</span>';
  });
</script>
```

- [ ] **Step 3: Create `src/components/ArtworkCard.astro`** (ported from `js/main.js` `artworkCard` + `formatAvailability`)

```astro
---
import type { Artwork } from '../lib/gallery';
interface Props { work: Artwork; }
const { work } = Astro.props;
const status = work.availability; // 'Available' | 'Inquire' | 'Sold'
---
<a class="art-card reveal is-visible" href={`/works/${work.slug}`}>
  <span class="frame frame--hover" data-ratio={work.ratio}>
    <img src={work.image} alt={`${work.title} (${work.year}), ${work.medium}, by ${work.artistName}`} loading="lazy" width="700" height="700" />
  </span>
  <span class="artist-name">{work.artistName}</span>
  <span class="art-title">{work.title}</span><span class="art-meta">, {work.year}</span>
  <div class="art-meta">{work.medium}</div>
  <div class="art-status">{status}</div>
</a>
```

- [ ] **Step 4: Create `src/components/ArtistCard.astro`** (ported from `js/main.js` `artistCard`)

```astro
---
import type { Artist } from '../lib/gallery';
interface Props { artist: Artist; image: string; }
const { artist, image } = Astro.props;
---
<a class="artist-card reveal is-visible" href={`/artists/${artist.slug}`}>
  <span class="frame frame--hover" data-ratio="portrait">
    <img src={image} alt={`Work by ${artist.name}`} loading="lazy" />
  </span>
  <h3 class="display">{artist.name}</h3>
  <p>{artist.birth} · {artist.discipline}</p>
</a>
```

- [ ] **Step 5: Create `src/components/InquiryModal.astro`** (ported from `js/main.js` `ensureModal`/`openInquiry`; the public POST target `/api/inquire` is implemented in the Inquiry-inbox plan — until then it falls back to the thank-you message, so this is safe to ship now)

Render the modal markup from `js/main.js` lines 181–196 (the price hint is already removed). Replace the inline form `onsubmit` with a script that, for now, prevents default and shows the thank-you (the Inquiry plan swaps in a real `fetch('/api/inquire')`). Expose a global `openInquiry(title)` that fills `#inqSub` and shows the modal:

```astro
<script>
  function ensure() { /* the modal is already in the DOM; just toggle */ }
  (window as any).openInquiry = (title?: string) => {
    const m = document.getElementById('inquireModal')!;
    (m.querySelector('#inqSub') as HTMLElement).textContent =
      title ? 'Regarding: ' + title : 'Tell us what you are looking for.';
    m.style.display = 'flex';
  };
  const m = document.getElementById('inquireModal');
  m?.querySelector('#inqClose')?.addEventListener('click', () => { m.style.display = 'none'; });
  m?.addEventListener('click', (e) => { if (e.target === m) (m as HTMLElement).style.display = 'none'; });
  m?.querySelector('form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    (e.target as HTMLElement).innerHTML =
      '<p class="lead" style="font-size:1.2rem;">Thank you. Your inquiry has been received — we’ll be in touch shortly.</p>';
  });
</script>
```

- [ ] **Step 6: Build to verify components compile (no pages use them yet, so just typecheck)**

Run: `npx astro check || true` then `npm run build`
Expected: build succeeds (components are not yet imported, so no runtime use — this verifies syntax once pages import them in later tasks).

- [ ] **Step 7: Commit**

```bash
git add src/components src/lib/site.ts
git commit -m "feat: port header, footer, card, and inquiry-modal components"
```

---

## Task 4: Data-access seam (`gallery.ts`) backed by the ported generator

**Files:**
- Create: `src/lib/data.ts` (ported from `js/data.js`)
- Create: `src/lib/gallery.ts` (the seam)

- [ ] **Step 1: Port `js/data.js` to `src/lib/data.ts`**

Copy the entire generator from `js/data.js` into `src/lib/data.ts`, converting to an ES module that exports the data arrays. Remove the IIFE/global wrapper; instead export named consts. Keep the seeded PRNG, vocab arrays, `artSVG`, artists/artworks/exhibitions/fairs/press generation EXACTLY as-is (prices already removed). At the end, replace the `global.VERSO_DATA = {...}` block with:

```ts
export { artists, artworks, exhibitions, fairs, press, artSVG };
export const CATEGORIES_LIST = CATEGORIES;
export const SUBJECTS_LIST = SUBJECTS;
export const MEDIUMS_LIST = MEDIUMS;
export const TOTAL_INVENTORY = TOTAL_INVENTORY; // keep export name; no longer surfaced publicly
```

Add a TypeScript type for the work/artist objects at the top so `gallery.ts` can import them (see Step 2 for the canonical types — define them in `gallery.ts` and import into `data.ts` if convenient, or duplicate minimal shapes here).

- [ ] **Step 2: Create `src/lib/gallery.ts` — the data-access interface**

This is the seam the whole site reads through. The Artwork CMS plan replaces the bodies with Supabase queries; signatures must not change.

```ts
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
  id: string; slug: string; name: string; birth: string;
  discipline: string; bio: string;
}
export interface Artwork {
  id: string; slug: string; title: string;
  artistId: string; artistName: string; artistSlug: string;
  year: number; medium: string; category: string; subject: string;
  dimensions: string; ratio: string;
  availability: 'Available' | 'Inquire' | 'Sold'; image: string;
}
export interface Exhibition {
  id: string; slug: string; title: string; subtitle: string;
  status: 'On View' | 'Upcoming' | 'Past'; dates: string; year: number;
  artistIds: string[]; blurb: string;
}
export interface Fair { name: string; city: string; booth: string; dates: string; status: string; }
export interface PressItem { outlet: string; headline: string; date: string; kind: string; }

export async function getArtworks(): Promise<Artwork[]> { return _artworks as Artwork[]; }
export async function getArtwork(slug: string): Promise<Artwork | undefined> {
  return (_artworks as Artwork[]).find((w) => w.slug === slug);
}
export async function getArtists(): Promise<Artist[]> { return _artists as Artist[]; }
export async function getArtist(slug: string): Promise<Artist | undefined> {
  return (_artists as Artist[]).find((a) => a.slug === slug);
}
export async function getWorksByArtist(artistId: string): Promise<Artwork[]> {
  return (_artworks as Artwork[]).filter((w) => w.artistId === artistId);
}
export async function getExhibitions(): Promise<Exhibition[]> { return _exhibitions as Exhibition[]; }
export async function getExhibition(slug: string): Promise<Exhibition | undefined> {
  return (_exhibitions as Exhibition[]).find((e) => e.slug === slug);
}
export async function getFairs(): Promise<Fair[]> { return _fairs as Fair[]; }
export async function getPress(): Promise<PressItem[]> { return _press as PressItem[]; }
export const categories = CATEGORIES_LIST;
export const subjects = SUBJECTS_LIST;
export { artSVG };
```

- [ ] **Step 3: Verify it typechecks**

Run: `npx astro check`
Expected: no type errors in `src/lib/`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/data.ts src/lib/gallery.ts
git commit -m "feat: add gallery data-access seam backed by ported generator"
```

---

## Task 5: Port slug + sanitize libs

**Files:**
- Create: `src/lib/slug.ts`, `src/lib/sanitize.ts`

- [ ] **Step 1: Copy `src/lib/slug.ts`** verbatim from the doula project (`C:\Users\wgrif\Projects\TheWildBirthDoulah\src\lib\slug.ts`) — `slugify` + `uniqueSlug`.

- [ ] **Step 2: Copy `src/lib/sanitize.ts`** verbatim from the doula project (`C:\Users\wgrif\Projects\TheWildBirthDoulah\src\lib\sanitize.ts`) — `sanitizeRichHtml`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/slug.ts src/lib/sanitize.ts
git commit -m "feat: port slug and sanitize libs"
```

---

## Task 6: Convert the home page

**Files:**
- Create: `src/pages/index.astro`
- Source: `index.html` `<main>` markup

- [ ] **Step 1: Create `src/pages/index.astro`**

Frontmatter loads featured works + current exhibition; body is the `<main>` from `index.html` with the hero/sections preserved. Build the JSON-LD Organization object (copy from `index.html` lines ~40–60, already price-free) and pass via `Layout`'s `jsonLd` prop. Render dynamic bits (current exhibition, selected works grid) from `gallery.ts`:

```astro
---
import Layout from '../layouts/Layout.astro';
import ArtworkCard from '../components/ArtworkCard.astro';
import InquiryModal from '../components/InquiryModal.astro';
import { getArtworks, getExhibitions } from '../lib/gallery';
import { BRAND } from '../lib/site';

const works = (await getArtworks()).slice(0, 8);
const exhibitions = await getExhibitions();
const current = exhibitions.find((e) => e.status === 'On View') ?? exhibitions[0];

const jsonLd = { /* paste the Organization JSON-LD object from index.html, price-free */ };
---
<Layout
  title="VERSO — Contemporary Art Gallery in Brooklyn, NY"
  description="VERSO is an independent contemporary art gallery in Williamsburg, Brooklyn, with a curated collection of contemporary works. Browse exhibitions, artists, and available works."
  jsonLd={jsonLd}
>
  <main>
    <!-- paste the <main> body from index.html here; replace:
         - the hero "current exhibition" text with {current.title} / {current.dates}
         - the selected-works grid with: {works.map((w) => <ArtworkCard work={w} />)}
         - any "20,000-work / open archive" copy with curated-collection wording
         - .html links with clean routes -->
  </main>
  <InquiryModal />
</Layout>
```

- [ ] **Step 2: Build and visually verify**

Run: `npm run build && npm run preview`
Open `http://localhost:4321/` — header, hero, selected works, footer render; nav links work; no console errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: convert home page to Astro"
```

---

## Task 7: Convert Works (collection) + artwork detail

**Files:**
- Create: `src/pages/works/index.astro`, `src/pages/works/[slug].astro`, `src/scripts/collection.ts`
- Source: `collection.html`, `artwork.html`, `js/collection.js`

- [ ] **Step 1: Port `js/collection.js` to `src/scripts/collection.ts`**

Copy the filter/sort/paginate logic. Change the data source: instead of `window.VERSO_DATA`, read a JSON blob the page embeds in `<script id="works-data" type="application/json">`. Parse it at top: `const D = { artworks: JSON.parse(document.getElementById('works-data')!.textContent!) }`. Remove the price sort branches (already removed in source). Keep AVAILABILITY/category/subject/artist filters, URL sync, chips, pagination. Remove the `D.totalInventory` "in full archive" suffix in the count line (no fake archive number).

- [ ] **Step 2: Create `src/pages/works/index.astro`**

Frontmatter fetches all artworks and serializes them for the client script. Body is the `collection.html` `<main>` (toolbar, filters, results grid container) minus price sort options (already removed). Embed data + load the script:

```astro
---
import Layout from '../../layouts/Layout.astro';
import InquiryModal from '../../components/InquiryModal.astro';
import { getArtworks, categories, subjects, getArtists } from '../../lib/gallery';
const artworks = await getArtworks();
const artists = await getArtists();
const jsonLd = {
  "@context": "https://schema.org", "@type": "CollectionPage",
  "name": "Works — VERSO Gallery", "url": "https://www.versogallery.com/works",
  "description": "A curated collection of contemporary artworks.",
};
---
<Layout title="Works — VERSO Gallery Brooklyn" description="Browse VERSO’s curated collection of contemporary artworks. Filter by medium, category, artist, year, and availability." jsonLd={jsonLd}>
  <main class="wrap section">
    <!-- paste collection.html <main> body: header, toolbar, filters drawer, #results, #pagination, #activeFilters, #empty, #resultCount -->
  </main>
  <script id="works-data" type="application/json" set:html={JSON.stringify(artworks)} />
  <InquiryModal />
  <script src="/src/scripts/collection.ts"></script>
</Layout>
```

Note: the filter option lists (`buildFilter`) read from the embedded data in the client script — keep that logic, fed by the parsed JSON. Render cards client-side using the same card HTML string as `ArtworkCard` (keep the string template in `collection.ts` so paginated results render without a round-trip).

- [ ] **Step 3: Create `src/pages/works/[slug].astro`**

`getStaticPaths` is not used (SSR); read `Astro.params.slug`, fetch the work, 404 if missing. Body is `artwork.html`'s detail markup (already price-free): spec list with Availability (no Price row), inquire button calling `window.openInquiry`, related works grid. Build the VisualArtwork + Offer (price-free) + Breadcrumb JSON-LD from the work.

```astro
---
import Layout from '../../layouts/Layout.astro';
import ArtworkCard from '../../components/ArtworkCard.astro';
import InquiryModal from '../../components/InquiryModal.astro';
import { getArtwork, getArtist, getWorksByArtist, getArtworks } from '../../lib/gallery';
const { slug } = Astro.params;
const work = await getArtwork(slug!);
if (!work) return new Response(null, { status: 404 });
const artist = await getArtist(work.artistSlug) ?? null;
let more = (await getWorksByArtist(work.artistId)).filter((x) => x.id !== work.id).slice(0, 4);
if (!more.length) more = (await getArtworks()).filter((x) => x.id !== work.id).slice(0, 4);
const offer = work.availability === 'Sold'
  ? { "@type": "Offer", "availability": "https://schema.org/SoldOut" }
  : { "@type": "Offer", "availability": "https://schema.org/InStock" };
const jsonLd = { "@context": "https://schema.org", "@type": "VisualArtwork",
  "name": work.title, "dateCreated": String(work.year), "artMedium": work.medium,
  "artform": work.category, "creator": { "@type": "Person", "name": work.artistName },
  "offers": offer };
---
<Layout title={`${work.title} (${work.year}) — ${work.artistName} | VERSO Gallery`}
  description={`${work.title} by ${work.artistName}, ${work.year}. ${work.medium}, ${work.dimensions}. ${work.availability} at VERSO Gallery, Brooklyn.`}
  jsonLd={jsonLd}>
  <main class="wrap section">
    <!-- paste artwork.html detail markup; bind {work.*}, {artist?.slug};
         spec list ends at Availability (no Price); inquire button:
         onclick={`openInquiry('${work.title} — ${work.artistName}')`} -->
    <section class="more">{more.map((w) => <ArtworkCard work={w} />)}</section>
  </main>
  <InquiryModal />
</Layout>
```

- [ ] **Step 4: Build and verify**

Run: `npm run build && npm run preview`
Open `/works` (filters, sort, search, pagination work; cards link to detail) and a `/works/w0000` detail page (renders, inquire modal opens, no Price row).

- [ ] **Step 5: Commit**

```bash
git add src/pages/works src/scripts/collection.ts
git commit -m "feat: convert works listing and artwork detail to Astro"
```

---

## Task 8: Convert Artists + artist detail

**Files:**
- Create: `src/pages/artists/index.astro`, `src/pages/artists/[slug].astro`
- Source: `artists.html`, `artist.html`

- [ ] **Step 1: Create `src/pages/artists/index.astro`**

```astro
---
import Layout from '../../layouts/Layout.astro';
import ArtistCard from '../../components/ArtistCard.astro';
import { getArtists, getWorksByArtist, artSVG } from '../../lib/gallery';
const artists = await getArtists();
const cards = await Promise.all(artists.map(async (a) => {
  const works = await getWorksByArtist(a.id);
  return { artist: a, image: works[0]?.image ?? artSVG(a.id, 'portrait') };
}));
---
<Layout title="Artists — VERSO Gallery Brooklyn" description="Emerging and mid-career contemporary artists represented by VERSO Gallery.">
  <main class="wrap section">
    <!-- paste artists.html header markup -->
    <div class="grid">{cards.map((c) => <ArtistCard artist={c.artist} image={c.image} />)}</div>
  </main>
</Layout>
```

- [ ] **Step 2: Create `src/pages/artists/[slug].astro`**

Read `Astro.params.slug`, fetch artist + their works; 404 if missing. Body is `artist.html` markup with bio + works grid (`ArtworkCard`). Add Person JSON-LD.

- [ ] **Step 3: Build and verify**

Run: `npm run build && npm run preview`
Open `/artists` and one `/artists/<slug>` — grid renders, detail shows bio + works.

- [ ] **Step 4: Commit**

```bash
git add src/pages/artists
git commit -m "feat: convert artists listing and detail to Astro"
```

---

## Task 9: Convert Exhibitions + exhibition detail

**Files:**
- Create: `src/pages/exhibitions/index.astro`, `src/pages/exhibitions/[slug].astro`
- Source: `exhibitions.html`, `exhibition.html`

- [ ] **Step 1: Create `src/pages/exhibitions/index.astro`**

Fetch exhibitions + fairs; group by status (On View / Upcoming / Past). Paste `exhibitions.html` markup; render lists from data.

- [ ] **Step 2: Create `src/pages/exhibitions/[slug].astro`**

Read slug, fetch exhibition + its artists (`getArtist` per id). Body is `exhibition.html` markup (already price-free — the checklist line no longer says "with prices"). Add Event JSON-LD.

- [ ] **Step 3: Build and verify**

Run: `npm run build && npm run preview`
Open `/exhibitions` and one `/exhibitions/<slug>`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/exhibitions
git commit -m "feat: convert exhibitions listing and detail to Astro"
```

---

## Task 10: Convert viewing-rooms, about, visit, contact, press, 404

**Files:**
- Create: `src/pages/viewing-rooms/index.astro`, `src/pages/about.astro`, `src/pages/visit.astro`, `src/pages/contact.astro`, `src/pages/press.astro`, `src/pages/404.astro`
- Source: matching root `.html` files

- [ ] **Step 1: Create `src/pages/viewing-rooms/index.astro`**

Port `viewing-rooms.html`. The room definitions (already price-free: "Sculpture & Object", "Brooklyn Abstraction", "New This Month", "Works on Paper") move into frontmatter, each filtering `getArtworks()` server-side; render 4 preview cards per room with `ArtworkCard`.

- [ ] **Step 2: Create `src/pages/about.astro`** — paste `about.html` `<main>` (already price-free; FAQ now availability-based). Add FAQPage JSON-LD from the existing object.

- [ ] **Step 3: Create `src/pages/visit.astro`** — paste `visit.html` `<main>` (priceRange already removed). Add LocalBusiness/Place JSON-LD.

- [ ] **Step 4: Create `src/pages/contact.astro`** — paste `contact.html` `<main>`. The contact form posts to `/api/inquire` (built in the Inquiry plan); for now keep the existing client-side thank-you handler so it works pre-API.

- [ ] **Step 5: Create `src/pages/press.astro`** — paste `press.html` `<main>`; render the press mentions list from `getPress()`.

- [ ] **Step 6: Create `src/pages/404.astro`** — paste `404.html` body inside `Layout` with `robots="noindex"`.

- [ ] **Step 7: Build and verify all routes**

Run: `npm run build && npm run preview`
Open each: `/viewing-rooms`, `/about`, `/visit`, `/contact`, `/press`, and a bad URL for 404.

- [ ] **Step 8: Commit**

```bash
git add src/pages/viewing-rooms src/pages/about.astro src/pages/visit.astro src/pages/contact.astro src/pages/press.astro src/pages/404.astro
git commit -m "feat: convert remaining public pages to Astro"
```

---

## Task 11: Supabase clients + env typing + DB types

**Files:**
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/types.ts`, `src/env.d.ts`

- [ ] **Step 1: Copy `src/lib/supabase/server.ts`** verbatim from the doula project (`createSupabaseServer` + `createSupabaseAdmin`, dual build/runtime env read). No changes needed.

- [ ] **Step 2: Create `src/lib/supabase/types.ts`** — row types matching the schema (Task 12). Define interfaces for each table:

```ts
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
  portrait_image_url: string | null; created_at: string; updated_at: string;
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
```

- [ ] **Step 3: Create `src/env.d.ts`** — type `App.Locals.user`:

```ts
/// <reference types="astro/client" />
declare namespace App {
  interface Locals {
    user?: { id: string; email: string };
  }
}
```

- [ ] **Step 4: Typecheck**

Run: `npx astro check`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase src/env.d.ts
git commit -m "feat: add Supabase clients, DB row types, locals typing"
```

---

## Task 12: Database schema

**Files:**
- Create: `supabase/schema.sql`

- [ ] **Step 1: Write `supabase/schema.sql`** — all tables from the spec, RLS, triggers, storage bucket. Model on the doula `schema.sql` patterns.

```sql
-- ===== updated_at trigger =====
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ===== artists =====
create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  birthplace text default '',
  birth_year int,
  discipline text default '',
  bio text default '',
  portrait_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== artworks =====
create table if not exists public.artworks (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  artist_id uuid references public.artists(id) on delete set null,
  year int,
  medium text default '',
  category text default '',
  subject text default '',
  dimensions text default '',
  ratio text default 'square',
  availability text not null default 'Available' check (availability in ('Available','Inquire','Sold')),
  image_url text,
  featured boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== exhibitions =====
create table if not exists public.exhibitions (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  subtitle text default '',
  status text not null default 'Upcoming' check (status in ('On View','Upcoming','Past')),
  start_date date,
  end_date date,
  blurb text default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.exhibition_artists (
  exhibition_id uuid references public.exhibitions(id) on delete cascade,
  artist_id uuid references public.artists(id) on delete cascade,
  primary key (exhibition_id, artist_id)
);

-- ===== fairs =====
create table if not exists public.fairs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text default '',
  booth text default '',
  dates text default '',
  status text not null default 'Upcoming' check (status in ('Upcoming','Past')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== viewing_rooms =====
create table if not exists public.viewing_rooms (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.viewing_room_artworks (
  viewing_room_id uuid references public.viewing_rooms(id) on delete cascade,
  artwork_id uuid references public.artworks(id) on delete cascade,
  position int not null default 0,
  primary key (viewing_room_id, artwork_id)
);

-- ===== inquiries =====
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid references public.artworks(id) on delete set null,
  artwork_title text default '',
  name text not null,
  email text not null,
  message text default '',
  status text not null default 'new' check (status in ('new','replied','archived')),
  source text not null default 'contact' check (source in ('artwork','contact')),
  created_at timestamptz not null default now()
);

-- ===== posts (journal/press) =====
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text default '',
  body text default '',
  cover_image_url text,
  status text not null default 'draft' check (status in ('draft','published')),
  category text not null default 'Journal' check (category in ('Journal','Press','Exhibitions')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== press_mentions =====
create table if not exists public.press_mentions (
  id uuid primary key default gen_random_uuid(),
  outlet text not null,
  headline text not null,
  url text default '',
  date text default '',
  kind text not null default 'Feature' check (kind in ('Review','Feature','Listing','Profile')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== updated_at triggers =====
do $$ declare t text;
begin
  foreach t in array array['artists','artworks','exhibitions','fairs','viewing_rooms','posts','press_mentions']
  loop
    execute format('drop trigger if exists trg_%s_touch on public.%s;', t, t);
    execute format('create trigger trg_%s_touch before update on public.%s for each row execute function public.touch_updated_at();', t, t);
  end loop;
end $$;

-- ===== RLS =====
alter table public.artists enable row level security;
alter table public.artworks enable row level security;
alter table public.exhibitions enable row level security;
alter table public.exhibition_artists enable row level security;
alter table public.fairs enable row level security;
alter table public.viewing_rooms enable row level security;
alter table public.viewing_room_artworks enable row level security;
alter table public.inquiries enable row level security;
alter table public.posts enable row level security;
alter table public.press_mentions enable row level security;

-- public read for catalogue tables
do $$ declare t text;
begin
  foreach t in array array['artists','artworks','exhibitions','exhibition_artists','fairs','viewing_rooms','viewing_room_artworks','press_mentions']
  loop
    execute format('drop policy if exists %s_public_read on public.%s;', t, t);
    execute format('create policy %s_public_read on public.%s for select using (true);', t, t);
  end loop;
end $$;

-- posts: anon reads published; authenticated reads all
drop policy if exists posts_public_read on public.posts;
create policy posts_public_read on public.posts for select using (status = 'published');
drop policy if exists posts_auth_read on public.posts;
create policy posts_auth_read on public.posts for select to authenticated using (true);

-- inquiries: NO public policies (service-role only for insert + read)

-- ===== storage bucket =====
insert into storage.buckets (id, name, public)
values ('gallery-images','gallery-images', true)
on conflict (id) do nothing;
drop policy if exists galleryimg_public_read on storage.objects;
create policy galleryimg_public_read on storage.objects
  for select using (bucket_id = 'gallery-images');
-- writes via service-role key only (no anon/auth write policy).
```

- [ ] **Step 2: Document setup in `supabase/README.md`**

```markdown
# Supabase setup
1. Create a project at supabase.com.
2. SQL Editor → run `schema.sql`.
3. Project Settings → API: copy URL, anon key, service_role key into `.env` and Vercel project env:
   PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
4. Authentication → Providers → Email: enable; disable "Allow new users to sign up".
5. Authentication → Users → Add user: create the single admin (email + password).
```

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql supabase/README.md
git commit -m "feat: add Supabase schema and setup docs"
```

---

## Task 13: Auth/session/CSRF/cache middleware

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Create `src/middleware.ts`** — port from doula, with VERSO route lists.

```ts
import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServer } from './lib/supabase/server';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isPublicCacheable(pathname: string): boolean {
  if (pathname.startsWith('/admin')) return false;
  if (pathname.startsWith('/api')) return false;
  if (pathname.startsWith('/_')) return false;
  return true;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // CSRF: host-only Origin check on writes to privileged surfaces
  if (WRITE_METHODS.has(context.request.method) &&
      (pathname.startsWith('/admin') || pathname.startsWith('/_actions'))) {
    const origin = context.request.headers.get('origin');
    const host = context.request.headers.get('host');
    if (origin && host) {
      try {
        if (new URL(origin).host !== host) {
          return new Response('Cross-site request blocked', { status: 403 });
        }
      } catch { return new Response('Invalid origin', { status: 403 }); }
    }
  }

  // Resolve session for all requests (never throw)
  try {
    const supabase = createSupabaseServer(context.cookies, context.request.headers);
    const { data } = await supabase.auth.getUser();
    if (data.user) context.locals.user = { id: data.user.id, email: data.user.email ?? '' };
  } catch { /* logged out */ }

  // Admin guard (allow login through)
  const isAdmin = pathname.startsWith('/admin');
  if (pathname === '/admin/login') {
    // allow
  } else if (isAdmin && !context.locals.user) {
    return context.redirect('/admin/login', 302);
  }

  const res = await next();

  if (context.request.method === 'GET' && isPublicCacheable(pathname)) {
    res.headers.set('Cache-Control',
      context.locals.user ? 'private, no-store'
        : 'public, s-maxage=60, stale-while-revalidate=86400');
  }
  return res;
});
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds; middleware compiles.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add auth/CSRF/cache middleware"
```

---

## Task 14: Admin login, logout, dashboard shell, AdminLayout

**Files:**
- Create: `src/styles/admin.css`, `src/layouts/AdminLayout.astro`, `src/pages/admin/login.astro`, `src/pages/admin/logout.ts`, `src/pages/admin/index.astro`

- [ ] **Step 1: Create `src/styles/admin.css`** — minimal VERSO-dark admin styling. Define `.admin-shell`, `.admin-card`, `.admin-field`, `.admin-btn`, `.admin-status.err`, `.admin-nav`, table styles, using the gallery's ink/paper palette (reuse CSS vars from `styles.css`: `--ink`, `--paper`, `--line`). Keep it small and functional.

```css
.admin-shell { background: #16150f; color: #e9e6dc; min-height: 100vh; font-family: system-ui, sans-serif; }
.admin-wrap { max-width: 1100px; margin: 0 auto; padding: 1.5rem; }
.admin-nav { display: flex; gap: 1rem; flex-wrap: wrap; padding: 1rem 1.5rem; border-bottom: 1px solid #2c2a20; }
.admin-nav a { color: #cfc9b8; text-decoration: none; font-size: .9rem; }
.admin-nav a[aria-current] { color: #fff; text-decoration: underline; }
.admin-card { background: #1d1b13; border: 1px solid #2c2a20; padding: 1.25rem; border-radius: 4px; }
.admin-field { margin-bottom: 1rem; display: flex; flex-direction: column; gap: .35rem; }
.admin-field input, .admin-field textarea, .admin-field select { background: #11100b; border: 1px solid #3a382b; color: #e9e6dc; padding: .6rem .75rem; font-size: 1rem; border-radius: 3px; }
.admin-btn { background: #c0492f; color: #fff; border: none; padding: .65rem 1.1rem; font-size: .95rem; cursor: pointer; border-radius: 3px; }
.admin-status.err { color: #ff9b87; font-size: .9rem; }
table.admin-table { width: 100%; border-collapse: collapse; }
table.admin-table th, table.admin-table td { text-align: left; padding: .55rem .6rem; border-bottom: 1px solid #2c2a20; font-size: .9rem; }
.login-shell { display: flex; align-items: center; justify-content: center; padding: 1.5rem; }
.login-wrap { width: 100%; max-width: 400px; }
```

- [ ] **Step 2: Create `src/layouts/AdminLayout.astro`** — chrome + nav for all admin pages.

```astro
---
import '../styles/admin.css';
interface Props { title: string; }
const { title } = Astro.props;
const path = Astro.url.pathname;
const links = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/artworks', label: 'Artworks' },
  { href: '/admin/artists', label: 'Artists' },
  { href: '/admin/inquiries', label: 'Inquiries' },
  { href: '/admin/exhibitions', label: 'Exhibitions' },
  { href: '/admin/viewing-rooms', label: 'Viewing Rooms' },
  { href: '/admin/press', label: 'Press' },
  { href: '/admin/posts', label: 'Journal' },
];
---
<!doctype html>
<html lang="en"><head>
  <meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" /><title>{title} · VERSO admin</title>
</head>
<body class="admin-shell">
  <nav class="admin-nav">
    {links.map((l) => <a href={l.href} aria-current={path === l.href ? 'page' : undefined}>{l.label}</a>)}
    <a href="/admin/logout" style="margin-left:auto;">Sign out</a>
  </nav>
  <main class="admin-wrap"><slot /></main>
</body></html>
```

Note: `/admin/artworks`, `/admin/artists`, etc. are built in the module plans; until then those links 404, which is acceptable for the foundation.

- [ ] **Step 3: Create `src/pages/admin/login.astro`** — adapt the doula login (already read). Use `admin.css`, VERSO branding, redirect to `/admin` on success.

```astro
---
export const prerender = false;
import '../../styles/admin.css';
import { createSupabaseServer } from '../../lib/supabase/server';
let error = '';
if (Astro.request.method === 'POST') {
  const form = await Astro.request.formData();
  const email = String(form.get('email') ?? '');
  const password = String(form.get('password') ?? '');
  const supabase = createSupabaseServer(Astro.cookies, Astro.request.headers);
  const { error: e } = await supabase.auth.signInWithPassword({ email, password });
  if (e) error = e.message; else return Astro.redirect('/admin', 303);
}
---
<!doctype html>
<html lang="en"><head>
  <meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" /><title>VERSO admin sign in</title>
</head>
<body class="admin-shell login-shell">
  <main class="login-wrap">
    <div class="admin-card">
      <p style="letter-spacing:.16em;text-transform:uppercase;font-size:.72rem;color:#c0492f;">VERSO</p>
      <h1 style="font-weight:400;margin:.3rem 0 1.2rem;">Admin sign in</h1>
      {error && <p class="admin-status err">{error}</p>}
      <form method="POST">
        <div class="admin-field"><label for="email">Email</label>
          <input id="email" name="email" type="email" required autocomplete="username" /></div>
        <div class="admin-field"><label for="password">Password</label>
          <input id="password" name="password" type="password" required autocomplete="current-password" /></div>
        <button class="admin-btn" type="submit" style="width:100%;">Sign in</button>
      </form>
    </div>
  </main>
</body></html>
```

- [ ] **Step 4: Create `src/pages/admin/logout.ts`**

```ts
import type { APIRoute } from 'astro';
import { createSupabaseServer } from '../../lib/supabase/server';

export const ALL: APIRoute = async ({ cookies, request, redirect }) => {
  const supabase = createSupabaseServer(cookies, request.headers);
  await supabase.auth.signOut();
  return redirect('/admin/login', 303);
};
```

- [ ] **Step 5: Create `src/pages/admin/index.astro`** — dashboard shell behind the guard.

```astro
---
export const prerender = false;
import AdminLayout from '../../layouts/AdminLayout.astro';
const user = Astro.locals.user!;
---
<AdminLayout title="Dashboard">
  <h1 style="font-weight:400;">Dashboard</h1>
  <p>Signed in as {user.email}.</p>
  <p>Use the nav above to manage artworks, artists, inquiries, exhibitions, viewing rooms, press, and the journal.</p>
</AdminLayout>
```

- [ ] **Step 6: Manual auth test (requires Supabase provisioned + admin user created — Task 12 README)**

Run: `npm run dev`
- Visit `/admin` → redirects to `/admin/login`.
- Sign in with the admin credentials → lands on `/admin` dashboard showing the email.
- Visit `/admin/logout` → back to login; `/admin` redirects again.

If Supabase is not yet provisioned, this step is deferred; note it and continue (the code is verified by `npm run build`).

- [ ] **Step 7: Commit**

```bash
git add src/styles/admin.css src/layouts/AdminLayout.astro src/pages/admin
git commit -m "feat: add admin login, logout, dashboard shell, AdminLayout"
```

---

## Task 15: Test setup (slug + sanitize)

**Files:**
- Create: `vitest.config.ts`, `tests/slug.test.ts`, `tests/sanitize.test.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['tests/**/*.test.ts'] } });
```

- [ ] **Step 2: Write `tests/slug.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { slugify, uniqueSlug } from '../src/lib/slug';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Soft Architecture II')).toBe('soft-architecture-ii');
  });
  it('strips punctuation and edges', () => {
    expect(slugify('  Untitled (No. 4)!  ')).toBe('untitled-no-4');
  });
});

describe('uniqueSlug', () => {
  it('returns base when free', () => {
    expect(uniqueSlug('verso', ['other'])).toBe('verso');
  });
  it('suffixes when taken', () => {
    expect(uniqueSlug('verso', ['verso', 'verso-2'])).toBe('verso-3');
  });
});
```

- [ ] **Step 3: Write `tests/sanitize.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { sanitizeRichHtml } from '../src/lib/sanitize';

describe('sanitizeRichHtml', () => {
  it('keeps allowed tags', () => {
    expect(sanitizeRichHtml('<p>hi <strong>there</strong></p>')).toContain('<strong>there</strong>');
  });
  it('drops scripts', () => {
    expect(sanitizeRichHtml('<p>x</p><script>alert(1)</script>')).not.toContain('<script>');
  });
  it('forces rel on links', () => {
    expect(sanitizeRichHtml('<a href="https://x.com">x</a>')).toContain('rel="noopener noreferrer"');
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts tests
git commit -m "test: add slug and sanitize unit tests"
```

---

## Task 16: Vercel config, sitemap, llms/SEO parity

**Files:**
- Modify: `public/llms.txt`, `public/llms-full.txt` (route updates), delete `public/sitemap.xml`

- [ ] **Step 1: Confirm Vercel deploy config**

No `vercel.json` is required — Vercel auto-detects Astro and the `@astrojs/vercel` adapter produces the SSR output (`.vercel/output`). Node 22 is pinned via `engines.node` in `package.json` (Task 1). Nothing to create here; this step is a checkpoint. If a custom config is ever needed, add a minimal `vercel.json`, but do not add one now.

- [ ] **Step 2: Delete the static sitemap** (the integration generates one)

Run: `git rm public/sitemap.xml`

- [ ] **Step 3: Update `public/llms.txt` + `public/llms-full.txt`** — change page URLs from `*.html` to clean routes (`/collection.html`→`/works`, `/about.html`→`/about`, etc.) and the works link description (already price-free). No price content remains (verified in Task 1).

- [ ] **Step 4: Update `public/robots.txt`** — ensure `Sitemap:` points to `https://www.versogallery.com/sitemap-index.xml` (the integration's output).

- [ ] **Step 5: Build and confirm sitemap output**

Run: `npm run build`
Expected: `dist/` contains `sitemap-index.xml`; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add public/llms.txt public/llms-full.txt public/robots.txt
git commit -m "chore: update sitemap, llms, robots for clean routes"
```

---

## Task 17: Remove legacy static files (after parity confirmed)

**Files:**
- Delete: root `*.html`, `js/`, `css/`

- [ ] **Step 1: Confirm every old page has an Astro equivalent**

Checklist (must all exist): index, works(+detail), artists(+detail), exhibitions(+detail), viewing-rooms, about, visit, contact, press, 404. Confirm `npm run build && npm run preview` renders each.

- [ ] **Step 2: Remove legacy files**

Run:
```bash
git rm index.html collection.html artwork.html artists.html artist.html exhibitions.html exhibition.html viewing-rooms.html about.html visit.html contact.html press.html 404.html
git rm -r js css
```

- [ ] **Step 3: Build clean**

Run: `npm run build`
Expected: succeeds with no references to removed files.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove legacy static HTML/JS/CSS after Astro parity"
```

---

## Self-review (completed during authoring)

**Spec coverage:** Architecture (Tasks 1,13), public Layout/components (2,3), data seam (4), public pages incl. price-free copy (6–10), Supabase clients/types (11), schema incl. all spec tables + storage (12), middleware auth/CSRF/cache (13), auth + admin shell (14), tests (15), hosting/SEO (16), legacy cleanup (17). Module-specific tables (inquiries/posts/etc.) are created here but their admin UIs + public wiring are deferred to the four module plans, as designed. The `/api/inquire` endpoint and contact/modal wiring are owned by the Inquiry plan; foundation ships safe client-side fallbacks.

**Placeholder scan:** Page-conversion tasks reference existing repo HTML as the source content (it exists in-tree) and provide the full new frontmatter/data-binding code; this is a transformation instruction, not a missing-content placeholder. No "TBD/handle errors/add validation" steps.

**Type consistency:** `gallery.ts` interfaces (`Artwork`, `Artist`, `Exhibition`, `Fair`, `PressItem`) are used consistently by components (Tasks 3) and pages (6–10). DB row types in `types.ts` (Task 11) match `schema.sql` columns (Task 12). `App.Locals.user` typed in Task 11, set in Task 13, read in Task 14.

---

## Follow-on plans (to be written next)

1. `2026-06-14-gallery-artwork-cms.md` — swap `gallery.ts` to Supabase; `/admin/artworks` + `/admin/artists` CRUD + image upload; seed-from-generator one-shot optional.
2. `2026-06-14-gallery-inquiry-inbox.md` — `/api/inquire`, wire modal + contact form, `/admin/inquiries`.
3. `2026-06-14-gallery-exhibitions-rooms-press.md` — admin CRUD + public wiring for exhibitions, viewing rooms, fairs, press mentions.
4. `2026-06-14-gallery-journal-blog.md` — TipTap editor, posts CRUD, public `/journal` + `/journal/[slug]`.
