// Parses `git log` into site version entries for the versions page.
// Fallback data source when Supabase site_versions table is empty.
// Format: %H|%cI|%s  (full SHA | ISO 8601 date | commit subject)

import { execSync } from 'node:child_process';

export interface DeploymentEntry {
  commit_sha: string;
  deployed_at: string;
  summary: string;
}

/**
 * Get deployment history from the local git log.
 * Filters out memory-only commits (Seppo's shift log bookkeeping).
 * Falls back to — gracefully when git is unavailable.
 */
export function getDeployments(limit = 50): DeploymentEntry[] {
  try {
    const output = execSync(
      `git log --format='%H|%cI|%s' -${limit}`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    );

    return output
      .trim()
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => {
        const [commitSha, dateStr, ...subjectParts] = line.split('|');
        const summary = subjectParts.join('|');
        return { commit_sha: commitSha, deployed_at: dateStr, summary };
      })
      .filter(
        (entry) =>
          // Exclude Seppo's memory/shift log bookkeeping commits
          !entry.summary.match(
            /^\[Seppo\]\s+(memory:\s+shift\s+log|shift\s+log\s+\d{4})/,
          ),
      );
  } catch {
    return [];
  }
}
