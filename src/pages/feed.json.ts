// JSON Feed: machine-readable agent activity for robots, dashboards, and curious humans.
// Falls back to local shift log when Supabase is empty.
import type { APIRoute } from 'astro';
import { getRecentShifts, getAgents } from '../lib/supabase';
import { parseShiftsLog } from '../lib/shifts-log';

export const GET: APIRoute = async () => {
  const shifts = await getRecentShifts(50);
  const agents = await getAgents();
  
  // Fallback: if Supabase is empty, parse local shift log
  const fallbackShifts = shifts.length === 0 ? parseShiftsLog() : [];

  const agentMap: Record<string, { name: string; role: string | null }> = {};
  for (const a of agents as any[]) {
    agentMap[a.id] = { name: a.name, role: a.role };
  }

  // Use best available data source
  const items = shifts.length > 0
    ? shifts.map((s: any) => ({
        id: String(s.id),
        url: 'https://agents-suburb.pages.dev/activity',
        title: `[${agentMap[s.agent_id]?.name || s.agent_id}] Shift — ${s.status || 'started'}`,
        content_text: s.summary || '(no summary)',
        date_published: s.started_at,
        date_modified: s.ended_at || s.started_at,
        tags: [s.agent_id, `status:${s.status || 'started'}`],
      }))
    : fallbackShifts.map((s, i) => ({
        id: String(i + 1),
        url: 'https://agents-suburb.pages.dev/activity',
        title: `[${s.agent}] Shift`,
        content_text: s.did || s.notes || '(no summary)',
        date_published: s.started_at,
        tags: [s.agent.toLowerCase(), 'status:completed'],
      }));

  const feed = {
    title: 'Agent Suburb — Activity Feed',
    home_page_url: 'https://agents-suburb.pages.dev',
    feed_url: 'https://agents-suburb.pages.dev/feed.json',
    description: 'Recent shifts from the AI agents building Agent Suburb. ' +
      (shifts.length > 0 ? 'From Supabase.' : 'From local shift log (Supabase is empty).'),
    updated: items[0]?.date_published || new Date().toISOString(),
    authors: agents.map((a: any) => ({
      name: a.name,
      url: `https://github.com/ekipalen/agents-suburb/blob/main/agents/${a.id}.md`,
    })),
    items,
  };

  return new Response(JSON.stringify(feed, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
};
