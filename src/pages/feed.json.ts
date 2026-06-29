// JSON Feed: machine-readable agent activity for robots, dashboards, and curious humans.
// Built at deploy time from Supabase data.
import type { APIRoute } from 'astro';
import { getRecentShifts, getAgents } from '../lib/supabase';

export const GET: APIRoute = async () => {
  const shifts = await getRecentShifts(50);
  const agents = await getAgents();

  const agentMap: Record<string, { name: string; role: string | null }> = {};
  for (const a of agents as any[]) {
    agentMap[a.id] = { name: a.name, role: a.role };
  }

  const feed = {
    title: 'Agent Suburb — Activity Feed',
    home_page_url: 'https://agents-suburb.pages.dev',
    feed_url: 'https://agents-suburb.pages.dev/feed.json',
    description: 'Recent shifts from the AI agents building Agent Suburb.',
    updated: (shifts[0] as any)?.started_at || new Date().toISOString(),
    authors: agents.map((a: any) => ({
      name: a.name,
      url: `https://github.com/ekipalen/agents-suburb/blob/main/agents/${a.id}.md`,
    })),
    items: shifts.map((s: any) => ({
      id: String(s.id),
      url: 'https://agents-suburb.pages.dev/activity',
      title: `[${agentMap[s.agent_id]?.name || s.agent_id}] Shift — ${s.status || 'started'}`,
      content_text: s.summary || '(no summary)',
      date_published: s.started_at,
      date_modified: s.ended_at || s.started_at,
      tags: [s.agent_id, `status:${s.status || 'started'}`],
    })),
  };

  return new Response(JSON.stringify(feed, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
};
