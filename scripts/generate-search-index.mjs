// Build-time search index generator.
// Reads all .md and .astro content, extracts text, and outputs a JSON index
// that the client-side /search page loads for full-text search.
// Output: public/search-index.json

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const OUTPUT = join(ROOT, 'public', 'search-index.json');

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripMarkdown(md) {
  return md
    .replace(/^---[\s\S]*?---/m, '')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~`>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractAstroContent(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const body = raw.replace(/^---[\s\S]*?---/m, '');
    return stripHtml(body);
  } catch {
    return '';
  }
}

function extractMdContent(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return stripMarkdown(raw);
  } catch {
    return '';
  }
}

function pathToUrl(filePath) {
  const rel = relative(join(ROOT, 'src', 'pages'), filePath);
  const withoutExt = rel.replace(extname(rel), '');
  if (withoutExt === 'index') return '/';
  return '/' + withoutExt;
}

function getTitle(content, fallback) {
  const h1 = content.match(/<h1[^>]*>([^<]+)<\/h1>/);
  if (h1) return h1[1].trim();
  const title = content.match(/title>\s*([^<\n]+)\s*</);
  if (title) return title[1].trim();
  return fallback;
}

function collectPages(dir, section) {
  const entries = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) continue;
      if (!entry.endsWith('.astro') && !entry.endsWith('.ts')) continue;
      // Skip API endpoints
      if (entry.endsWith('.json.ts') || entry.endsWith('.xml.ts')) continue;

      const content = entry.endsWith('.astro')
        ? extractAstroContent(full)
        : extractAstroContent(full);
      if (!content || content.length < 20) continue;

      const path = pathToUrl(full);
      const title = getTitle(content, entry.replace(/\.[^.]+$/, ''));

      entries.push({
        title,
        path,
        content: content.slice(0, 3000),
        section,
      });
    }
  } catch {
    // skip
  }
  return entries;
}

function collectMarkdown(dir, section) {
  const entries = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) continue;
      if (!entry.endsWith('.md')) continue;
      if (entry === 'shifts.md' || entry === 'state.md') continue;

      const content = extractMdContent(full);
      if (!content || content.length < 20) continue;

      const name = entry.replace('.md', '');
      const label = name.charAt(0).toUpperCase() + name.slice(1);

      entries.push({
        title: label,
        path: '',
        content: content.slice(0, 3000),
        section,
      });
    }
  } catch {
    // skip
  }
  return entries;
}

function main() {
  const entries = [];

  entries.push(...collectPages(join(ROOT, 'src', 'pages'), 'Page'));
  entries.push(...collectMarkdown(join(ROOT, 'content'), 'Content'));
  entries.push(...collectMarkdown(join(ROOT, 'agents'), 'Agent'));

  try {
    for (const entry of readdirSync(join(ROOT, 'memory'))) {
      if (!entry.endsWith('.md')) continue;
      const content = extractMdContent(readFileSync(join(ROOT, 'memory', entry), 'utf-8'));
      entries.push({
        title: entry.replace('.md', ''),
        path: '',
        content: content.slice(0, 3000),
        section: 'Memory',
      });
    }
  } catch { /* skip */ }

  writeFileSync(OUTPUT, JSON.stringify(entries));
  const kb = (JSON.stringify(entries).length / 1024).toFixed(1);
  console.log(`Generated search-index.json (${kb} KB) from ${entries.length} files`);
}

main();
