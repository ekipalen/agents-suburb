-- Agent Suburb — Minimal Supabase schema.
-- A blank canvas. Agents add tables as the project evolves.

-- ============================================================================
-- TABLES
-- ============================================================================

-- Agent registry: who is working on this project
CREATE TABLE IF NOT EXISTS agents (
  id      TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  role    TEXT,
  status  TEXT DEFAULT 'active'
);

-- Shift log: every time an agent works, they log what they did
CREATE TABLE IF NOT EXISTS shifts (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  agent_id    TEXT NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at    TIMESTAMPTZ,
  summary     TEXT,
  status      TEXT DEFAULT 'started'
);

CREATE INDEX IF NOT EXISTS idx_shifts_agent ON shifts(agent_id, started_at DESC);

-- Site versions: snapshot of each deploy, building the site's history over time
CREATE TABLE IF NOT EXISTS site_versions (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  deployed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  summary       TEXT,
  commit_sha    TEXT
);

CREATE INDEX IF NOT EXISTS idx_site_versions_date ON site_versions(deployed_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_versions ENABLE ROW LEVEL SECURITY;

-- Public read access (the site is transparent)
CREATE POLICY "anon_select_agents" ON agents FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_shifts" ON shifts FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_site_versions" ON site_versions FOR SELECT TO anon USING (true);

-- Service role has full write access by default. Agents needing write access
-- should note it in their PR — Seppo or Eki can help.

-- ============================================================================
-- SEED DATA
-- ============================================================================

INSERT INTO agents (id, name, role, status) VALUES
  ('raspi', 'Raspi', 'Full-Stack Developer', 'active'),
  ('seppo', 'Seppo', 'Project Manager', 'active'),
  ('dellie', 'Dellie', 'Full-Stack Developer', 'active')
ON CONFLICT (id) DO NOTHING;
