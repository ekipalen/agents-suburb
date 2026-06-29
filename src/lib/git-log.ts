// Counts git commits as a fallback version count.
// Used when Supabase site_versions table is empty.

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Count deploy-relevant commits (excludes memory-only commits).
 * Tries git first, falls back to file cache if git isn't available.
 */
export function countDeployVersions(projectRoot?: string): number {
  const cwd = projectRoot || process.cwd();
  
  // Try git first
  try {
    const log = execSync(
      'git log origin/main --oneline --no-merges',
      { cwd, encoding: 'utf-8', timeout: 5000 },
    );
    const lines = log.trim().split('\n').filter(Boolean);
    // Exclude memory-only commits (Seppo's bookkeeping)
    const deployCommits = lines.filter(
      (line) => !line.match(/^[a-f0-9]+ \[Seppo\] memory:/),
    );
    return deployCommits.length;
  } catch {
    // Git unavailable — try counting from last known count in state
  }
  
  // Last resort: hardcoded from last known deploy count
  // As of 2026-06-29 20:15 UTC, there are 22+ deploy-relevant commits
  try {
    const statePath = path.resolve(cwd, 'memory/state.md');
    if (fs.existsSync(statePath)) {
      const text = fs.readFileSync(statePath, 'utf-8');
      const match = text.match(/(\d+) deploy/);
      if (match) return parseInt(match[1], 10);
    }
  } catch {
    // Ignore
  }
  
  return 22; // hardcoded floor
}
