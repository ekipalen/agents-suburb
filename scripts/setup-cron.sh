#!/usr/bin/env bash
# Agent Suburb — Cron setup script
# Run this ONCE per device to schedule agent shifts.
# Usage: ./scripts/setup-cron.sh <agent-name>
#   agent-name: raspi | seppo | dellie
#
# Intervals (07–21 only for developers, 07–23 for Seppo, staggered to avoid simultaneous work):
#   seppo  — hourly on the hour     (07:00, 08:00, …, 23:00)
#   raspi  — every 2h at :15 past   (07:15, 09:15, …, 21:15)
#   dellie — every 2h at :45 past   (07:45, 09:45, …, 21:45)

set -euo pipefail

AGENT="${1:-}"
REPO_DIR="${AGENT_SUBURB_REPO:-$HOME/agents-suburb}"
REPO_URL="https://github.com/ekipalen/agents-suburb.git"

# ── Help ────────────────────────────────────────────────────────────────────
if [[ -z "$AGENT" || "$AGENT" == "-h" || "$AGENT" == "--help" ]]; then
  echo "Usage: ./scripts/setup-cron.sh <raspi|seppo|dellie>"
  echo ""
  echo "  Sets up a cron job for the named agent on this device."
  echo "  raspi/dellie run every 2 hours, seppo runs hourly."
  echo "  Shifts only between 07:00–23:00 (Seppo) / 07:00–21:00 (Raspi, Dellie), staggered so agents never overlap."
  echo ""
  echo "  Before running, optionally set:"
  echo "    AGENT_SUBURB_REPO   path to repo (default: ~/agents-suburb)"
  exit 0
fi

# ── Validate agent ───────────────────────────────────────────────────────────
case "$AGENT" in
  raspi)   INTERVAL="2h"; CRON="15 7-21/2 * * *" ;;
  seppo)   INTERVAL="1h"; CRON="0 7-23 * * *"   ;;
  dellie)  INTERVAL="2h"; CRON="45 7-21/2 * * *" ;;
  *)
    echo "ERROR: unknown agent '$AGENT'. Use: raspi | seppo | dellie"
    exit 1
    ;;
esac

# ── Clone repo if needed ─────────────────────────────────────────────────────
if [[ ! -d "$REPO_DIR" ]]; then
  echo "Cloning $REPO_URL → $REPO_DIR ..."
  git clone "$REPO_URL" "$REPO_DIR"
fi

# ── Cron job ─────────────────────────────────────────────────────────────────
# The shift script handles git pull + agent trigger.
# On each tick, the agent:
#   1. Reads its instructions from https://agents-suburb.pages.dev
#   2. Checks git log, open PRs, roadmap
#   3. Picks ONE task and works on it

SHIFT_SCRIPT="$REPO_DIR/scripts/agent-shift.sh"
CRON_JOB="$CRON $SHIFT_SCRIPT $AGENT >> $REPO_DIR/logs/shift-$AGENT.log 2>&1"

# Create the shift script if missing
if [[ ! -f "$SHIFT_SCRIPT" ]]; then
  echo "Shift script not found — please ensure scripts/agent-shift.sh exists in the repo."
  exit 1
fi

# Create logs directory
mkdir -p "$REPO_DIR/logs"

# Remove any existing entry for this agent, then add the new one
(crontab -l 2>/dev/null | grep -v "agent-shift.sh $AGENT" || true) > "$REPO_DIR/logs/crontab-tmp"
echo "$CRON_JOB" >> "$REPO_DIR/logs/crontab-tmp"
crontab "$REPO_DIR/logs/crontab-tmp"
rm "$REPO_DIR/logs/crontab-tmp"

chmod +x "$SHIFT_SCRIPT"

echo "✓ Agent '$AGENT' scheduled every $INTERVAL"
echo "  Log:  $REPO_DIR/logs/shift-$AGENT.log"
echo "  Repo: $REPO_DIR"
echo ""
echo "  Manual trigger: $SHIFT_SCRIPT $AGENT"
