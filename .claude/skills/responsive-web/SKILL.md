---
name: responsive-web
description: Make every website fully mobile-responsive. ALWAYS use this when building, scaffolding, or styling any website, web page, landing page, web app UI, HTML/CSS, or front-end component — and when the user asks to "make it responsive", "mobile-friendly", "works on phones", or reports layout breaking on small screens. Apply proactively on every web build, not only when asked.
---

# Responsive Web Skill

Standing instruction: **every website I build must be fully responsive** across
phone, tablet, and desktop, and pass a mobile audit before it's considered done.
Treat this as a default acceptance criterion, like "it compiles."

## Non-negotiables (do these on every site)

1. **Viewport meta** in every page `<head>`:
   ```html
   <meta name="viewport" content="width=device-width, initial-scale=1" />
   ```
2. **No horizontal scroll.** The page must never overflow sideways at any width.
   ```css
   html, body { max-width: 100%; overflow-x: hidden; }
   *, *::before, *::after { box-sizing: border-box; }
   img, svg, video, iframe, table { max-width: 100%; }
   ```
3. **Long content wraps**, never blows out the layout:
   ```css
   body { overflow-wrap: break-word; }
   ```
4. **Fluid type** with `clamp()` instead of fixed px headings:
   ```css
   h1 { font-size: clamp(2rem, 6vw, 4.5rem); }
   ```
5. **Mobile-first or fluid grids.** Multi-column layouts must collapse to fewer
   columns / a single column on small screens (CSS Grid `auto-fit/minmax`, or
   explicit breakpoints).
6. **Tap targets ≥ 44×44px** on touch; inputs use ≥16px font (prevents iOS zoom).
7. **Off-canvas / hamburger nav** below ~1000px; horizontal nav rows
   (tabs, chips, filters) scroll (`overflow-x:auto`) rather than wrap into a mess.
8. **Respect `prefers-reduced-motion`** and device safe areas
   (`env(safe-area-inset-*)`) for notched devices.

## Default breakpoints

Design fluid first; add breakpoints only where layout actually breaks. Sensible set:

- `≤ 1024px` — tablet: drop 4-col → 3-col / 2-col, tighten gutters.
- `≤ 768px` — large phone: collapse to hamburger nav, stack two-column sections.
- `≤ 480px` — small phone: single column, smaller base font, full-width buttons.

Use `clamp()` for spacing too: `--section: clamp(3rem, 8vw, 9rem);`.

## Drop-in responsive baseline (copy into the global stylesheet)

```css
*, *::before, *::after { box-sizing: border-box; }
html, body { max-width: 100%; overflow-x: hidden; }
body { overflow-wrap: break-word; -webkit-text-size-adjust: 100%; }
img, svg, video, iframe, table { max-width: 100%; height: auto; }
input, textarea, select, button { max-width: 100%; font-size: 16px; }

/* Horizontal scroll rows instead of broken wrapping */
.scroll-x { overflow-x: auto; -webkit-overflow-scrolling: touch;
            scrollbar-width: none; flex-wrap: nowrap; }
.scroll-x::-webkit-scrollbar { display: none; }

/* Comfortable touch targets */
@media (hover: none) and (pointer: coarse) {
  a, button, [role="button"], label, .nav-link { min-height: 44px; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important;
                           scroll-behavior: auto !important; }
}
```

For framework projects use the idiomatic tool: **Tailwind** responsive prefixes
(`sm: md: lg:`), **Bootstrap** grid, or CSS Modules with media queries — but the
*acceptance criteria* below still apply.

## Mandatory verification before "done"

Do not claim a site is responsive without checking it. In order of preference:

1. **Headless screenshots at multiple widths** (best). With Playwright:
   ```js
   for (const w of [375, 390, 768, 1024, 1440]) {
     await page.setViewportSize({ width: w, height: 900 });
     await page.goto(url);
     await page.screenshot({ path: `shot-${w}.png` });
   }
   ```
   Inspect each: no horizontal scrollbar, nav usable, text readable, nothing clipped.
2. **Assert no horizontal overflow** programmatically:
   ```js
   const overflow = await page.evaluate(() =>
     document.documentElement.scrollWidth > document.documentElement.clientWidth);
   if (overflow) throw new Error('Horizontal overflow at this width');
   ```
3. If no browser is available, **review the CSS against the checklist below** and
   say so explicitly (don't claim it was visually verified when it wasn't).

## Mobile audit checklist

- [ ] Viewport meta present on every page.
- [ ] No horizontal scroll at 320, 375, 390, 768, 1024px.
- [ ] All grids collapse sensibly (no 4 columns crammed on a phone).
- [ ] Nav collapses to an accessible hamburger / off-canvas menu; menu closes.
- [ ] Tap targets ≥ 44px; form inputs ≥ 16px font; no accidental iOS zoom.
- [ ] Images/media never overflow; use `srcset`/responsive images at scale.
- [ ] Tables and code blocks scroll or reflow instead of overflowing.
- [ ] Sticky headers/footers respect `env(safe-area-inset-*)` on notched phones.
- [ ] Modals/drawers are full-width-friendly and scroll internally.
- [ ] Text is readable (≥15–16px body) and line length is comfortable.
- [ ] `prefers-reduced-motion` honored.
- [ ] Verified with screenshots or an explicit CSS review noted to the user.

## Reusing this across projects

This is a global skill, so it applies to every website build automatically. To
pin it to a specific repo, copy this file to `.claude/skills/responsive-web/SKILL.md`
in that project so teammates and future sessions inherit it too.
