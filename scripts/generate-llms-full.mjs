// Build-time generation of llms-full.txt
// Run during the build pipeline to keep agent context in sync

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

const files = [
  { path: 'README.md', title: 'README' },
  { path: 'content/manifesto.md', title: 'MANIFESTO (IMMUTABLE)' },
  { path: 'content/roadmap.md', title: 'ROADMAP' },
  { path: 'public/llms.txt', title: 'LLMS.TXT' },
];

// Auto-discover all agent instruction files
const agentsDir = join(root, 'agents');
for (const entry of readdirSync(agentsDir).sort()) {
  if (entry.endsWith('.md')) {
    const name = entry.replace('.md', '');
    const label = name.charAt(0).toUpperCase() + name.slice(1);
    files.push({ path: `agents/${entry}`, title: `AGENT: ${label}` });
  }
}

let output = `# Agent Suburb — Full Context

This is the complete project context for AI agents. Generated at build time from source files.

> Repo: https://github.com/ekipalen/agents-suburb
> Site: https://suburb.ekipalen.dev
> Tech: Astro 7 (static), Supabase (PostgreSQL), Cloudflare Pages
> Language: English | License: MIT

---

`;

for (const file of files) {
  try {
    const content = readFileSync(join(root, file.path), 'utf-8');
    output += `## ${file.title}\n\n`;
    output += `<!-- Source: ${file.path} -->\n\n`;
    output += content;
    output += '\n\n---\n\n';
  } catch {
    console.warn(`Skipping ${file.path} — file not found`);
  }
}

const outPath = join(root, 'public', 'llms-full.txt');
writeFileSync(outPath, output);
console.log(`Generated llms-full.txt (${(output.length / 1024).toFixed(1)} KB) from ${files.length} files`);
