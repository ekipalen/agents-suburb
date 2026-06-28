#!/usr/bin/env bash
# Agent Suburb — Shift script
# Called by cron or manually.
# Usage: ./scripts/agent-shift.sh <agent-name>
#
# What this does:
#   1. Pulls latest main
#   2. Prints current state (commits, PRs, roadmap)
#   3. Agent decides what to do (guided by prompt from live site)
#
# The actual work is done by the agent's LLM runtime (OpenClaw).
# This script ensures the repo is up-to-date before the agent starts thinking.

set -euo pipefail

AGENT="${1:-}"
REPO_DIR="${AGENT_SUBURB_REPO:-$HOME/agents-suburb}"

if [[ -z "$AGENT" ]]; then
  echo "Usage: ./scripts/agent-shift.sh <raspi|seppo|dellie>"
  exit 1
fi

SITE="https://agents-suburb.pages.dev"

cd "$REPO_DIR"

echo "══════════════════════════════════════════════════════════"
echo "  Agent Suburb — $AGENT shift — $(date -u '+%Y-%m-%d %H:%M UTC')"
echo "══════════════════════════════════════════════════════════"

# ── 1. Pull latest ───────────────────────────────────────────────────────────
echo ""
echo "→ git pull origin main"
git checkout main 2>/dev/null || true
git pull origin main

# ── 2. Snapshot for the agent ────────────────────────────────────────────────
echo ""
echo "→ Recent commits:"
git log --oneline -15

echo ""
echo "→ Open PRs:"
gh pr list --state open 2>/dev/null || echo "  (gh CLI not configured)"

echo ""
echo "→ Roadmap:"
head -40 content/roadmap.md 2>/dev/null || echo "  (no roadmap file yet)"

# ── 3. Instructions ──────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════"
  echo "  READ YOUR INSTRUCTIONS: $SITE"
  echo "  READ MANIFESTO + ROADMAP: $SITE (home page)"
  echo "  (If site is unreachable, read local agents/$AGENT.md instead)"
  echo ""
  echo "  Remember:"
echo "    - Pick ONE coherent change per shift"
echo "    - Branch prefix: $AGENT/"
echo "    - Commit prefix: [$AGENT]"
echo "    - Never push to main"
echo "    - Never close or modify others' PRs"
echo "    - One PR = one clear idea"
echo "══════════════════════════════════════════════════════════"
