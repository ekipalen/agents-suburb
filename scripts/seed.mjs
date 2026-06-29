#!/usr/bin/env node
/**
 * Seed Supabase tables with real agent data.
 * 
 * Usage:
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/seed-shifts.mjs
 * 
 * Reads:
 *   - memory/shifts.md (structured shift log)
 *   - git log (for site_versions from commit history)
 * 
 * Writes to:
 *   - shifts (agent shift entries)
 *   - site_versions (deploy snapshots from merged PRs)
 * 
 * Idempotent: checks for existing data, won't duplicate.
 * Safe: uses Service Role key (not committed), requires explicit env var.
 */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  console.error('   Get the service_role key from Supabase dashboard → Project Settings → API.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Supabase client (thin fetch wrapper — no dependency needed)
// ---------------------------------------------------------------------------

async function supabaseFetch(path, { method = 'POST', body } = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
  };
  
  if (method === 'GET' || method === 'HEAD') {
    delete headers['Content-Type'];
  }
  
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return res;
}

async function check(table) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?limit=1`;
  const headers = {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Accept': 'application/json',
    'Range': '0-0',
  };
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`check ${table}: ${res.status}`);
  const data = await res.json();
  return data.length > 0;
}

// ---------------------------------------------------------------------------
// Parse shift log
// ---------------------------------------------------------------------------

function parseShiftsLog() {
  const path = resolve(process.cwd(), 'memory/shifts.md');
  const text = readFileSync(path, 'utf-8');
  
  // Format: ## YYYY-MM-DD HH:MM — Agent
  const re = /^## (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) — (\w+)/gm;
  const entries = [...text.matchAll(re)];
  
  return entries.map(m => {
    const [dateStr, timeStr] = m[1].split(' ');
    const started_at = new Date(`${dateStr}T${timeStr}:00Z`).toISOString();
    
    // Extract the "Did:" field
    const startIdx = m.index;
    const endIdx = entries.indexOf(m) + 1 < entries.length 
      ? entries[entries.indexOf(m) + 1].index 
      : text.length;
    const block = text.slice(startIdx, endIdx);
    
    // Extract summary from various field formats
    const didMatch = block.match(/- \*\*Did\*\*: (.+)/m);
    const reviewMatch = block.match(/- \*\*Review\*\*: (.+)/m);
    const mergeMatch = block.match(/- \*\*Merged\*\*: (.+)/m);
    const summary = (didMatch || reviewMatch || mergeMatch)?.[1]?.trim() || 'Shift completed';
    
    return {
      agent_id: m[2].toLowerCase(),
      started_at,
      summary,
      status: 'completed',
    };
  });
}

// ---------------------------------------------------------------------------
// Parse git log for site versions
// ---------------------------------------------------------------------------

function parseGitVersions() {
  // Non-merge commits (Seppo uses squash) — filter out memory-only commits
  const cmd = `git log origin/main --format='%h|%aI|%s' --no-merges -50`;
  const output = execSync(cmd, { encoding: 'utf-8', cwd: resolve(process.cwd()) });
  
  const lines = output.trim().split('\n').filter(Boolean);
  
  // Filter out memory-only commits (Seppo's bookkeeping)
  const featureCommits = lines.filter(line => {
    const msg = line.split('|')[2] || '';
    return !msg.startsWith('[Seppo] memory:') && !msg.startsWith('memory:');
  });
  
  // Take unique meaningful versions (first 20)
  return featureCommits.slice(0, 20).map(line => {
    const [sha, date, ...msgParts] = line.split('|');
    const summary = msgParts.join('|');
    return {
      deployed_at: date,  // git already outputs ISO 8601 with timezone
      commit_sha: sha,
      summary: summary || 'Site update',
    };
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('🌱 Agent Suburb — Supabase seed script');
  console.log(`   URL: ${SUPABASE_URL}`);
  console.log('');
  
  // --- SHIFTS ---
  const shiftsExist = await check('shifts');
  if (shiftsExist) {
    console.log('⏭️  shifts table: already has data, skipping.');
  } else {
    const shifts = parseShiftsLog();
    console.log(`   Parsed ${shifts.length} shifts from memory/shifts.md`);
    console.log('   Writing to shifts table...');
    
    let written = 0;
    for (const shift of shifts) {
      try {
        await supabaseFetch('shifts', { body: shift });
        written++;
      } catch (err) {
        console.error(`   ⚠️  Failed to insert shift for ${shift.agent_id}: ${err.message}`);
      }
    }
    console.log(`   ✅ Wrote ${written}/${shifts.length} shifts`);
  }
  
  // --- SITE VERSIONS ---
  const versionsExist = await check('site_versions');
  if (versionsExist) {
    console.log('⏭️  site_versions table: already has data, skipping.');
  } else {
    const versions = parseGitVersions();
    console.log(`   Parsed ${versions.length} versions from git merge log`);
    console.log('   Writing to site_versions table...');
    
    let written = 0;
    for (const ver of versions) {
      try {
        await supabaseFetch('site_versions', { body: ver });
        written++;
      } catch (err) {
        console.error(`   ⚠️  Failed to insert version ${ver.commit_sha}: ${err.message}`);
      }
    }
    console.log(`   ✅ Wrote ${written}/${versions.length} versions`);
  }
  
  console.log('');
  console.log('🏁 Seed complete. Visit https://agents-suburb.pages.dev to see the results.');
}

main().catch(err => {
  console.error('❌ Fatal:', err.message);
  process.exit(1);
});
