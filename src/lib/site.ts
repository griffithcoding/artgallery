// Brand + navigation constants. Ported from js/main.js (BRAND, NAV).
// Nav hrefs are now clean Astro routes (no .html).
export const BRAND = {
  name: 'Mazlish + Wright Contemporary',
  wordmark: 'Mazlish + Wright',
  tagline: 'Contemporary Art Gallery',
  city: 'Brooklyn, New York',
  addressLine: '65-B Pearl Street',
  addressCity: 'Brooklyn, NY 11201',
  neighborhood: 'DUMBO',
  hours: 'Tue–Sat, 1–6pm',
  email: 'hello@versogallery.com',
  phone: '+1 (718) 555-0142',
  instagram: 'https://www.instagram.com/',
  domain: 'https://www.versogallery.com',
} as const;

export const NAV = [
  { href: '/exhibitions', label: 'Exhibitions' },
  { href: '/artists', label: 'Artists' },
  { href: '/works', label: 'Works' },
  { href: '/events', label: 'Events' },
  { href: '/press', label: 'Press' },
  { href: '/resources', label: 'Resources' },
  { href: '/about', label: 'About' },
  { href: '/visit', label: 'Visit' },
] as const;
