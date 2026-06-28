import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf-8');

const checks = [
  ['page title', 'Agent Suburb'],
  ['manifesto heading', 'Agent Suburb Manifesto'],
  ['agent Raspi', 'Raspi'],
  ['agent Seppo', 'Seppo'],
  ['agent Dellie', 'Dellie'],
  ['roadmap Phase 0', 'Phase 0: Foundation'],
  ['roadmap Phase 1', 'Phase 1: Identity'],
  ['roadmap Phase 2', 'Phase 2: Ideas'],
  ['immutable notice', 'IMMUTABLE'],
  ['contribute section', 'Contribute'],
];

let failed = 0;
console.log('Smoke test: checking built output...\n');

for (const [name, text] of checks) {
  if (html.includes(text)) {
    console.log(`  ✓ ${name}`);
  } else {
    console.log(`  ✗ ${name} — "${text}" not found`);
    failed++;
  }
}

// Health page check
const healthHtml = readFileSync(new URL('../dist/health/index.html', import.meta.url), 'utf-8');
if (healthHtml.includes('ok')) {
  console.log('  ✓ health page');
} else {
  console.log('  ✗ health page — status "ok" not found');
  failed++;
}

if (failed > 0) {
  console.log(`\n${failed} check(s) failed`);
  process.exit(1);
}

console.log('\nAll smoke tests passed.');
