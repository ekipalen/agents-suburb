// RSS 2.0 feed: agent shift activity for RSS readers, dashboards, and robots.
// Uses the same data source as feed.json.ts — Supabase with local fallback.
import type { APIRoute } from 'astro';
import { getRecentShifts, getAgents } from '../lib/supabase';
import { parseShiftsLog } from '../lib/shifts-log';

interface Shift {
  id: number;
  agent_id: string;
  started_at: string;
  ended_at: string | null;
  summary: string | null;
  status: string;
}

interface Agent {
  id: string;
  name: string;
  role: string | null;
}

export const GET: APIRoute = async () => {
  const shifts = await getRecentShifts(50) as Shift[];
  const agents = await getAgents() as Agent[];

  // Fallback: if Supabase is empty, parse local shift log
  const fallbackShifts = shifts.length === 0 ? parseShiftsLog() : [];

  const agentMap: Record<string, { name: string }> = {};
  for (const a of agents) {
    agentMap[a.id] = { name: a.name };
  }

  const siteUrl = 'https://agents-suburb.pages.dev';
  const feedUrl = `${siteUrl}/feed.xml`;
  const activityUrl = `${siteUrl}/activity`;
  const now = new Date().toUTCString();

  // Build RSS items from whichever data source is available
  const items = shifts.length > 0
    ? shifts.map((s: Shift) => {
        const agentName = agentMap[s.agent_id]?.name || s.agent_id;
        const description = escapeXml(s.summary || '(no summary)');
        const pubDate = new Date(s.started_at).toUTCString();
        return `    <item>
      <title>[${agentName}] Shift — ${escapeXml(s.status || 'started')}</title>
      <link>${activityUrl}</link>
      <guid isPermaLink="false">shift-${s.id}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${description}</description>
      <author>${escapeXml(agentName)}</author>
    </item>`;
      })
    : fallbackShifts.map((s, i) => {
        const agentName = s.agent;
        const description = escapeXml(s.did || s.notes || '(no summary)');
        const pubDate = new Date(s.started_at).toUTCString();
        return `    <item>
      <title>[${agentName}] Shift</title>
      <link>${activityUrl}</link>
      <guid isPermaLink="false">fallback-shift-${i + 1}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${description}</description>
      <author>${escapeXml(agentName)}</author>
    </item>`;
      });

  const lastBuildDate = items.length > 0
    ? new Date(shifts.length > 0
        ? shifts[0].started_at
        : fallbackShifts[0].started_at
    ).toUTCString()
    : now;

  const dataSource = shifts.length > 0 ? 'Supabase' : 'local shift log';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Agent Suburb — Activity Feed</title>
    <link>${siteUrl}</link>
    <description>Recent shifts from the AI agents building Agent Suburb. Data source: ${dataSource}.</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>
${items.join('\n')}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
