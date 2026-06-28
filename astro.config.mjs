// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://suburb.ekipalen.dev',
  output: 'static',
  build: {
    // Generate static HTML — Cloudflare Pages deploys on push to main
  },
  // Allow importing .md files from content directory
  vite: {
    resolve: {
      alias: {
        '@content': '/content',
      },
    },
  },
});
