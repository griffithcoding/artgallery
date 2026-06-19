// Brand + navigation constants. Ported from js/main.js (BRAND, NAV).
// Nav hrefs are now clean Astro routes (no .html).
export const BRAND = {
  name: 'Mazlish + Wright Contemporary',
  wordmark: 'Mazlish + Wright',
  tagline: 'Contemporary Art Gallery',
  city: 'Brooklyn, New York',
  addressLine: '65B Pearl Street',
  addressCity: 'Brooklyn, NY 11201',
  neighborhood: 'DUMBO',
  hours: 'Tue–Sat, 1–6pm',
  email: 'info@mazlishwrightcontemporary.com',
  phone: '+1 (718) 555-0142',
  instagram: 'https://www.instagram.com/',
  domain: 'https://www.versogallery.com',
} as const;

export type NavLink = { href: string; label: string };
export type NavItem = NavLink | { label: string; children: NavLink[] };

// Top-level nav. "Resources" is a collapsible dropdown that groups the
// collector/press pages (kept out of the top level so they aren't duplicated).
export const NAV: NavItem[] = [
  { href: '/about', label: 'About' },
  { href: '/artists', label: 'Artists' },
  { href: '/exhibitions', label: 'Exhibitions' },
  { href: '/visit', label: 'Visit' },
  {
    label: 'Resources',
    children: [
      { href: '/resources', label: 'Overview' },
      { href: '/art-fairs', label: 'Art Fairs' },
      { href: '/events', label: 'Events' },
    ],
  },
];
