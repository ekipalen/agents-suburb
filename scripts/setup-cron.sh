#!/usr/bin/env bash
# Agent Suburb — Cron setup script
# Run this ONCE per device to schedule agent shifts.
# Usage: ./scripts/setup-cron.sh <agent-name> [repo-path]
#   agent-name: raspi | seppo | dellie
#   repo-path:  path to repo (default: ~/agents-suburb)
#
# Intervals (07–21 only for developers, 07–23 for Seppo, staggered to avoid simultaneous work):
#   seppo  — hourly on the hour     (07:00, 08:00, …, 23:00)
#   raspi  — every 2h at :15 past   (07:15, 09:15, …, 21:15)
#   dellie — every 2h at :45 past   (07:45, 09:45, …, 21:45)

set -euo pipefail

AGENT="${1:-}"
REPO_DIR="${2:-${AGENT_SUBURB_REPO:-$HOME/agents-suburb}}"
REPO_URL="https://github.com/ekipalen/agents-suburb.git"

# ── Help ────────────────────────────────────────────────────────────────────
if [[ -z "$AGENT" || "$AGENT" == "-h" || "$AGENT" == "--help" ]]; then
  cat <<EOF
Usage: ./scripts/setup-cron.sh <raspi|seppo|dellie> [repo-path]

  Sets up a cron job for the named agent on this device.
  raspi/dellie run every 2 hours, seppo runs hourly.
  Shifts only between 07:00–23:00 (Seppo) / 07:00–21:00 (Raspi, Dellie),
  staggered so agents never overlap.

  repo-path defaults to ~/agents-suburb or \$AGENT_SUBURB_REPO.

Examples:
  ./scripts/setup-cron.sh raspi
  ./scripts/setup-cron.sh seppo ~/projects/agents-suburb
EOF
  exit 0
fi

# ── Validate agent ───────────────────────────────────────────────────────────
case "$AGENT" in
  raspi)   INTERVAL="2h"; CRON_SCHEDULE="15 7-21/2 * * *" ;;
  seppo)   INTERVAL="1h"; CRON_SCHEDULE="0 7-23 * * *"   ;;
  dellie)  INTERVAL="2h"; CRON_SCHEDULE="45 7-21/2 * * *" ;;
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

# ── Find the agent-specific shift script ─────────────────────────────────────
# Each agent has its own shift script: agent-shift-<agent>.sh
# The generic agent-shift.sh is a placeholder for manual debugging.
AGENT_SCRIPT="$REPO_DIR/scripts/agent-shift-$AGENT.sh"
GENERIC_SCRIPT="$REPO_DIR/scripts/agent-shift.sh"

if [[ -f "$AGENT_SCRIPT" ]]; then
  SHIFT_SCRIPT="$AGENT_SCRIPT"
  # Agent-specific scripts handle their own OpenClaw session key
  CRON_JOB="$CRON_SCHEDULE $SHIFT_SCRIPT >> $REPO_DIR/logs/shift-$AGENT.log 2>&1"
  echo "→ Using agent-specific script: agent-shift-$AGENT.sh"
elif [[ -f "$GENERIC_SCRIPT" ]]; then
  SHIFT_SCRIPT="$GENERIC_SCRIPT"
  # Generic script takes agent name as argument
  CRON_JOB="$CRON_SCHEDULE $SHIFT_SCRIPT $AGENT >> $REPO_DIR/logs/shift-$AGENT.log 2>&1"
  echo "→ Using generic script: agent-shift.sh (agent-specific script not found)"
else
  echo "ERROR: No shift script found."
  echo "  Expected: $AGENT_SCRIPT or $GENERIC_SCRIPT"
  echo "  Make sure the repo is cloned and up to date."
  exit 1
fi

# ── Create logs directory ────────────────────────────────────────────────────
mkdir -p "$REPO_DIR/logs"

# ── Remove existing cron entry for this agent, then add the new one ─────────
(crontab -l 2>/dev/null | grep -v "agent-shift.*$AGENT" || true) > /tmp/crontab-suburb-tmp
echo "$CRON_JOB" >> /tmp/crontab-suburb-tmp
crontab /tmp/crontab-suburb-tmp
rm /tmp/crontab-suburb-tmp

chmod +x "$SHIFT_SCRIPT"

# ── Verify ───────────────────────────────────────────────────────────────────
ACTIVE_CRON=$(crontab -l 2>/dev/null | grep "agent-shift.*$AGENT" || echo "(not found)")

echo ""
echo "✓ Agent '$AGENT' scheduled every $INTERVAL"
echo "  Schedule:  $CRON_SCHEDULE"
echo "  Script:    $SHIFT_SCRIPT"
echo "  Log:       $REPO_DIR/logs/shift-$AGENT.log"
echo "  Repo:      $REPO_DIR"
echo ""
echo "  Active cron entry:"
echo "    $ACTIVE_CRON"
echo ""
echo "  Manual trigger: $SHIFT_SCRIPT"
