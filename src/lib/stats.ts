// Computes stats from git log + shift log (local fallback data source).
// Returns per-agent breakdown, weekly trends, and deployment timeline.

import { execSync } from 'node:child_process';
import { parseShiftsLog, type ParsedShift } from './shifts-log';

export interface AgentStats {
  id: string;
  name: string;
  shifts: number;
  prs: number;
  firstShift: string | null;
  lastShift: string | null;
}

export interface DailyCount {
  date: string; // YYYY-MM-DD
  shifts: number;
  prs: number;
}

export interface StatsData {
  totalShifts: number;
  totalPRs: number;
  agents: AgentStats[];
  daily: DailyCount[];
  busiestDay: DailyCount | null;
  latestShift: string | null;
}

const AGENT_NAMES: Record<string, string> = {
  raspi: 'Raspi',
  seppo: 'Seppo',
  dellie: 'Dellie',
};

function countPRsPerAgent(): Record<string, number> {
  try {
    const log = execSync(
      'git log --format="%s" origin/main --not --remotes=origin/HEAD 2>/dev/null || git log --format="%s" main',
      { encoding: 'utf-8', timeout: 5000 },
    );
    const counts: Record<string, number> = {};
    for (const line of log.split('\n')) {
      // [Raspi] ... or [Dellie] ... prefix
      const m = line.match(/^\[(Raspi|Seppo|Dellie)\]/i);
      if (m) {
        const agent = m[1].toLowerCase();
        counts[agent] = (counts[agent] || 0) + 1;
      }
    }
    return counts;
  } catch {
    return {};
  }
}

function buildAgentStats(shifts: ParsedShift[], prCounts: Record<string, number>): AgentStats[] {
  const shiftCounts: Record<string, { count: number; first: string; last: string }> = {};

  for (const s of shifts) {
    const key = s.agent.toLowerCase();
    if (!shiftCounts[key]) {
      shiftCounts[key] = { count: 0, first: s.started_at, last: s.started_at };
    }
    shiftCounts[key].count++;
    if (s.started_at < shiftCounts[key].first) shiftCounts[key].first = s.started_at;
    if (s.started_at > shiftCounts[key].last) shiftCounts[key].last = s.started_at;
  }

  const agentIds = new Set([...Object.keys(shiftCounts), ...Object.keys(prCounts)]);

  return [...agentIds]
    .map((id) => ({
      id,
      name: AGENT_NAMES[id] || id,
      shifts: shiftCounts[id]?.count || 0,
      prs: prCounts[id] || 0,
      firstShift: shiftCounts[id]?.first || null,
      lastShift: shiftCounts[id]?.last || null,
    }))
    .sort((a, b) => b.shifts + b.prs - (a.shifts + a.prs));
}

function buildDailyCounts(shifts: ParsedShift[]): DailyCount[] {
  const map: Record<string, { shifts: number; prs: number }> = {};

  for (const s of shifts) {
    const date = s.started_at.slice(0, 10); // YYYY-MM-DD
    if (!map[date]) map[date] = { shifts: 0, prs: 0 };
    map[date].shifts++;
    if (s.pr && s.pr !== 'none') map[date].prs++;
  }

  // Also count PRs from git (merge commits) per day
  try {
    const log = execSync(
      'git log --format="%cI %s" main',
      { encoding: 'utf-8', timeout: 5000 },
    );
    for (const line of log.split('\n')) {
      const m = line.match(/^(\d{4}-\d{2}-\d{2}).*Merge (pull request|PR) #/);
      if (m) {
        const date = m[1];
        if (!map[date]) map[date] = { shifts: 0, prs: 0 };
        map[date].prs++;
      }
    }
  } catch {
    // git log failed — skip
  }

  return Object.entries(map)
    .map(([date, c]) => ({ date, ...c }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function computeStats(): StatsData {
  const shifts = parseShiftsLog();
  const prCounts = countPRsPerAgent();
  const agents = buildAgentStats(shifts, prCounts);
  const daily = buildDailyCounts(shifts);

  const busiestDay = daily.length > 0
    ? daily.reduce((best, d) => (d.shifts + d.prs > best.shifts + best.prs ? d : best), daily[0])
    : null;

  return {
    totalShifts: shifts.length,
    totalPRs: Object.values(prCounts).reduce((s, n) => s + n, 0),
    agents,
    daily,
    busiestDay,
    latestShift: shifts.length > 0 ? shifts[0].started_at : null,
  };
}
