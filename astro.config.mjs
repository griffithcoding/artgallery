import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

import react from '@astrojs/react';

export default defineConfig({
  site: 'https://www.versogallery.com',
  output: 'server',
  adapter: vercel(),
  security: { checkOrigin: false }, // replaced by Origin/Host check in middleware
  integrations: [sitemap({ changefreq: 'weekly', priority: 0.7 }), react()],
  build: { inlineStylesheets: 'auto' },
  compressHTML: true,
});