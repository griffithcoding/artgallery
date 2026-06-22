// src/lib/dashboard.ts
// Derives the dynamic onboarding checklist from data presence. Pure — the page
// supplies the counts.
export interface DashboardCounts {
  artists: number; artworks: number; exhibitions: number; fairs: number; homepageHero: boolean;
}
export interface ChecklistItem { key: string; label: string; href: string; done: boolean; }

export function buildChecklist(c: DashboardCounts): ChecklistItem[] {
  return [
    { key: 'artist', label: 'Add your first artist', href: '/admin/artists/new', done: c.artists > 0 },
    { key: 'artwork', label: 'Add your first artwork', href: '/admin/artworks/new', done: c.artworks > 0 },
    { key: 'exhibition', label: 'Create an exhibition', href: '/admin/exhibitions/new', done: c.exhibitions > 0 },
    { key: 'fair', label: 'Add an art fair', href: '/admin/fairs/new', done: c.fairs > 0 },
    { key: 'homepage', label: 'Set the homepage photo', href: '/admin/homepage', done: c.homepageHero },
  ];
}

export function checklistComplete(items: ChecklistItem[]): boolean {
  return items.every((i) => i.done);
}
