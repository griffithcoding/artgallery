// super_admin: artwork list for the works-picker. JSON: [{id,title,artistName}].
import type { APIRoute } from 'astro';
import { getArtworks } from '../../../lib/gallery';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user || user.role !== 'super_admin') return new Response('Forbidden', { status: 403 });
  const works = await getArtworks();
  const list = works.map((w) => ({ id: w.id, title: w.title, artistName: w.artistName }));
  return new Response(JSON.stringify(list), { status: 200, headers: { 'content-type': 'application/json' } });
};
