# VERSO — Brooklyn Contemporary Art Gallery (template site)

A complete, self-contained marketing/commerce website for a **fictional Brooklyn
contemporary art gallery** with an open archive of up to **20,000 works**. Built
as a static site (HTML + CSS + vanilla JS), with **no build step and no external
image dependencies** — all artwork visuals are generated as inline SVG
placeholders so the site runs anywhere, offline or hosted.

It was modeled on the structure and conventions of three real galleries —
[Fremin Gallery](https://www.fremingallery.com/),
[Mark Borghi](https://www.markborghi.com/), and
[The Untitled Space](https://untitled-space.com/) — borrowing their **page
architecture and UX patterns only** (decoupled inventory, exhibition/fair
templates, viewing rooms, inquire flow). **None of their artwork or copy is used.**

> "VERSO," the artists, the works, the address, and all copy are placeholders.
> Swap in real content via `js/data.js` and `js/main.js` (`VERSO_BRAND`).

## What's inside

| Page | File | Notes |
|---|---|---|
| Home | `index.html` | Hero, selected works, artists, about teaser |
| Works (the archive) | `collection.html` + `js/collection.js` | Filter / search / sort / paginate — scales to 20k |
| Artwork detail | `artwork.html` | `?id=` · VisualArtwork + Offer schema |
| Artists index | `artists.html` | Letter nav |
| Artist detail | `artist.html` | `?slug=` · Person schema |
| Exhibitions | `exhibitions.html` | Current / Upcoming / Past / Fairs tabs |
| Exhibition detail | `exhibition.html` | `?slug=` · ExhibitionEvent schema |
| Viewing Rooms | `viewing-rooms.html` | Curated themed collections |
| About | `about.html` | History, team, FAQPage schema |
| Visit | `visit.html` | Address, hours, LocalBusiness schema |
| Contact | `contact.html` | Inquiry form (front-end only) |
| Press | `press.html` | Coverage list |
| 404 | `404.html` | |

## Architecture

- **`js/data.js`** — the data layer. Generates a deterministic catalogue of
  artists, artworks, exhibitions, fairs, and press. Artwork images are seeded
  inline SVGs. Headline inventory is set to 20,000 (`totalInventory`); a
  representative subset (`demoCount`) is generated client-side for the demo.
  In production, replace this with a real `works.json` / API + a search index
  (Pagefind / FlexSearch) — the UI in `collection.js` is built for that.
- **`js/main.js`** — shared header/footer injection, navigation, scroll reveals,
  the inquire modal, and card render helpers. Brand values live in `VERSO_BRAND`.
- **`css/styles.css`** — the full design system (tokens, typography, components).
  Minimalist, white-space-heavy, serif display + grotesk UI.

## SEO + AI-engine optimization (built in)

- Per-page `<title>`, meta description, canonical, robots, Open Graph, Twitter cards.
- **JSON-LD structured data**: `ArtGallery`/`Organization`, `WebSite`,
  `VisualArtwork` + `Offer` (per work), `Person` (per artist),
  `ExhibitionEvent` (per show), `CollectionPage`, `AboutPage`, `ContactPage`,
  `FAQPage`, and `BreadcrumbList` — linked with stable `@id` anchors.
- `robots.txt` explicitly **allows AI/LLM crawlers** (GPTBot, ClaudeBot,
  PerplexityBot, Google-Extended, etc.).
- `sitemap.xml`, `manifest.webmanifest`.
- **`llms.txt`** + **`llms-full.txt`** (per [llmstxt.org](https://llmstxt.org))
  so AI answer engines can find and cite the gallery accurately.
- Speakable/AEO-friendly `.tldr-block` direct-answer blocks on key pages.

## Run it

It's static — just serve the folder:

```bash
cd brooklyn-gallery
python3 -m http.server 8000   # then open http://localhost:8000
```

Or open `index.html` directly in a browser.

## Going to production

1. Replace `js/data.js` with real inventory (`works.json` / CMS / API) and real images
   (WebP/AVIF, `srcset`, an image CDN at 20k scale).
2. Wire the inquiry + newsletter forms to a backend (Formspree, Netlify Forms, or your own).
3. Add real prices, swap `VERSO_BRAND` values, and update `llms.txt` / schema URLs to the live domain.
4. For the 20k catalogue, generate static `/works/[id]` pages at build time + a Pagefind index, and split `sitemap.xml` into sub-sitemaps under a sitemap index.

## Marketing

See **[MARKETING.md](./MARKETING.md)** for the competitor analysis, industry
trends, SEO/AEO playbook, and a prioritized list of marketing ideas tailored to
a new Brooklyn gallery.
