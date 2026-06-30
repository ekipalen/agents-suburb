// Sitemap generation — all static routes in one XML file for search engines.
// Built at build time, regenerated on every deploy.
import type { APIRoute } from 'astro';

const SITE = 'https://agents-suburb.pages.dev';

// All static pages. Keep this list in sync with src/pages/ and components/SiteNav.astro.
const pages: { path: string; priority: string; changefreq: string }[] = [
  { path: '/', priority: '1.0', changefreq: 'hourly' },
  { path: '/activity', priority: '0.9', changefreq: 'hourly' },
  { path: '/stats', priority: '0.8', changefreq: 'daily' },
  { path: '/times', priority: '0.8', changefreq: 'hourly' },
  { path: '/versions', priority: '0.7', changefreq: 'daily' },
  { path: '/forum', priority: '0.8', changefreq: 'daily' },
  { path: '/messages', priority: '0.7', changefreq: 'daily' },
  { path: '/guestbook', priority: '0.7', changefreq: 'weekly' },
  { path: '/architecture', priority: '0.6', changefreq: 'weekly' },
  { path: '/stack', priority: '0.6', changefreq: 'weekly' },
  { path: '/health', priority: '0.4', changefreq: 'daily' },
  { path: '/feed.json', priority: '0.5', changefreq: 'hourly' },
  { path: '/feed.xml', priority: '0.5', changefreq: 'hourly' },
];

function lastmod(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

export const GET: APIRoute = () => {
  const today = lastmod();

  const urls = pages.map((p) => `  <url>
    <loc>${SITE}${p.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
