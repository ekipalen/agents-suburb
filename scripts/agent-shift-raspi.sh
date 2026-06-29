#!/usr/bin/env bash
# Agent Suburb — Shift script (Raspi)
# Called by cron. Triggers a Raspi shift via OpenClaw agent CLI.
#
# Usage: ./scripts/agent-shift.sh
#
# This prepares the repo (git pull) and sends a shift prompt to the
# Raspi Suburb session. The agent then works autonomously within OpenClaw.

set -euo pipefail

# Ensure PATH includes common locations (cron has minimal PATH)
export PATH="$HOME/.local/bin:$HOME/.nvm/versions/node/v24.15.0/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
export HOME="$HOME"

REPO_DIR="${AGENT_SUBURB_REPO:-$HOME/projects/agents-suburb}"
SITE="https://agents-suburb.pages.dev"
SESSION_KEY="agent:main:raspi-suburb"
LOG_DIR="$REPO_DIR/logs"
TIMESTAMP=$(date -u '+%Y-%m-%d %H:%M UTC')
LOCAL_TIME=$(date '+%Y-%m-%d %H:%M %Z')

mkdir -p "$LOG_DIR"

echo "══════════════════════════════════════════════════════════" | tee -a "$LOG_DIR/shift-raspi.log"
echo "  Agent Suburb — Raspi shift — $TIMESTAMP ($LOCAL_TIME)" | tee -a "$LOG_DIR/shift-raspi.log"
echo "══════════════════════════════════════════════════════════" | tee -a "$LOG_DIR/shift-raspi.log"

# ── 1. Pull latest ───────────────────────────────────────────────────────────
cd "$REPO_DIR"
echo "→ git pull origin main" | tee -a "$LOG_DIR/shift-raspi.log"
git checkout main 2>/dev/null || true
git pull origin main 2>&1 | tee -a "$LOG_DIR/shift-raspi.log"

# ── 2. Snapshot for logging ──────────────────────────────────────────────────
echo "" | tee -a "$LOG_DIR/shift-raspi.log"
echo "→ Recent commits:" | tee -a "$LOG_DIR/shift-raspi.log"
git log --oneline -10 | tee -a "$LOG_DIR/shift-raspi.log"

echo "" | tee -a "$LOG_DIR/shift-raspi.log"
echo "→ Open PRs:" | tee -a "$LOG_DIR/shift-raspi.log"
gh pr list --state open 2>/dev/null | tee -a "$LOG_DIR/shift-raspi.log" || echo "  (gh CLI not configured)" | tee -a "$LOG_DIR/shift-raspi.log"

# ── 3. Trigger OpenClaw agent ────────────────────────────────────────────────
# This sends a shift prompt to the Raspi Suburb session.
# The agent handles the actual work: reads memory, picks a task, codes, opens PR.
SHIFT_PROMPT="AGENT SUBURB SHIFT — Raspi 🍇

Time: $TIMESTAMP ($LOCAL_TIME)

This is your scheduled shift. Follow your agent instructions at $SITE.

Your shift checklist:
1. Read your memory files: $REPO_DIR/memory/shifts.md and state.md — self-brief FIRST
2. Read agents/raspi.md for your full instructions
3. Check git log, open PRs, roadmap, and any open issues
4. Pick ONE coherent task from Phase 1 (Identity) — design tokens, typography, layout, dark/light theme, or Supabase integration
5. Create a branch (raspi/ prefix), work, commit ([Raspi] prefix), push, open PR
6. Update memory files BEFORE ending shift

Phase 1 tasks available (none started yet):
- Design tokens (CSS custom properties — colors, spacing, typography scale)
- Responsive layout system
- Dark/light theme toggle
- Typography improvements
- Agent avatars & branding
- Supabase integration (activity feed, shift log display)

Repo: $REPO_DIR
Memory: $REPO_DIR/memory/shifts.md and state.md

Remember: one PR = one coherent idea. Mobile-first. No pushing to main."

echo "" | tee -a "$LOG_DIR/shift-raspi.log"
echo "→ Triggering OpenClaw agent shift..." | tee -a "$LOG_DIR/shift-raspi.log"

# Send the shift prompt via openclaw agent CLI
# This creates/continues a session dedicated to Suburb shifts
# Run in background — agent may take several minutes
nohup openclaw agent \
  --agent main \
  --session-key "$SESSION_KEY" \
  --message "$SHIFT_PROMPT" \
  --timeout 900 \
  >> "$LOG_DIR/shift-raspi-agent.log" 2>&1 &

AGENT_PID=$!
echo "→ Agent triggered (PID $AGENT_PID), working in background" | tee -a "$LOG_DIR/shift-raspi.log"
echo "→ Agent log: $LOG_DIR/shift-raspi-agent.log" | tee -a "$LOG_DIR/shift-raspi.log"
echo "" | tee -a "$LOG_DIR/shift-raspi.log"
