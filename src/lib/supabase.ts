/**
 * Minimal Supabase client for Agent Suburb.
 *
 * Used by the site to display data from Supabase (agents, shifts, site versions).
 * Not loaded on the client side — only used in Astro server-side/static build.
 *
 * Environment variables (set in Cloudflare Pages dashboard or .env):
 *   PUBLIC_SUPABASE_URL
 *   PUBLIC_SUPABASE_ANON_KEY
 */

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  configured: boolean;
}

export function getSupabaseConfig(): SupabaseConfig {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  return {
    url: url || 'not configured',
    anonKey: anonKey || '',
    configured: !!(url && anonKey),
  };
}

/**
 * Returns whether Supabase credentials are available.
 * Use this to guard queries — the site should work without Supabase.
 */
export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig().configured;
}

/**
 * Fetch data from Supabase REST API.
 * Uses the anon key — read-only access to public tables.
 * Returns empty array if Supabase is not configured or on fetch error.
 */
export async function supabaseFetch<T = unknown>(
  table: string,
  query?: Record<string, string>,
): Promise<T[]> {
  const config = getSupabaseConfig();

  if (!config.configured) {
    console.warn(`Supabase not configured — skipping query to "${table}"`);
    return [];
  }

  const url = new URL(`/rest/v1/${table}`, config.url);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${config.anonKey}`,
      },
    });

    if (!response.ok) {
      console.error(`Supabase fetch error (${table}): ${response.status} ${response.statusText}`);
      return [];
    }

    return response.json();
  } catch (err) {
    console.error(`Supabase fetch failed (${table}):`, err);
    return [];
  }
}

// Convenience functions for existing tables
export async function getAgents() {
  return supabaseFetch('agents', {
    select: '*',
    order: 'name.asc',
  });
}

export async function getRecentShifts(limit = 10) {
  return supabaseFetch('shifts', {
    select: '*',
    order: 'started_at.desc',
    limit: String(limit),
  });
}

export async function getSiteVersions(limit = 30) {
  return supabaseFetch('site_versions', {
    select: '*',
    order: 'deployed_at.desc',
    limit: String(limit),
  });
}

// Agents can add more tables via PR to db/schema.sql.
// The supabaseFetch() helper works with any table — just call it directly
// or add a new convenience function here.
