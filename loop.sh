#!/usr/bin/env bash
# loop.sh — ralph loop: run Claude headless against loop/PROMPT.md until verify.sh passes.
# Doctrine: mechanical exit (verify.sh), verifier ≠ builder (verify.sh is fixed and not editable
# by the prompt's scope), scope fence in PROMPT.md, iteration cap, task branch only, no pushes.
# Usage: ./loop.sh [max_iterations]   (default 8). Run inside tmux on the seat.
# Model: LOOP_MODEL (default sonnet — iterations are spec-driven implementation; Fable is reserved
# for the human-gated review at PR time, per the route doctrine). Runs on the Max sub, $0 marginal.
set -uo pipefail
cd "$(dirname "$0")" || exit 1
MAX="${1:-8}"; i=0
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
case "$BRANCH" in main|master) echo "refusing to loop on $BRANCH — create a task branch"; exit 1;; esac
CLAUDE="${CLAUDE_BIN:-$(command -v claude || echo "$HOME/.local/bin/claude")}"
mkdir -p loop; : > loop/LOOP.log
notify() { command -v "$HOME/.claude/tools/telegram-notify.sh" >/dev/null 2>&1 && "$HOME/.claude/tools/telegram-notify.sh" "$1" >/dev/null 2>&1 || true; }
while ! ./verify.sh >>loop/LOOP.log 2>&1; do
  i=$((i+1)); [ $i -gt "$MAX" ] && { echo "cap $MAX reached, verify still failing" | tee -a loop/LOOP.log; notify "md-read loop: cap reached, still FAILING"; exit 2; }
  echo "=== iteration $i/$MAX $(date -Is)" | tee -a loop/LOOP.log
  "$CLAUDE" -p "$(cat loop/PROMPT.md)" --model "${LOOP_MODEL:-sonnet}" --permission-mode acceptEdits --allowedTools "Bash(npm:*) Bash(npx:*) Bash(node:*) Bash(cargo:*) Bash(./verify.sh:*) Bash(git:*) Bash(ls:*) Bash(cat:*) Bash(grep:*) Bash(head:*) Bash(tail:*) Bash(wc:*) Bash(diff:*) Edit Write Read Glob Grep" --max-turns 60 2>&1 | tail -40 | tee -a loop/LOOP.log
  git add -A && git commit -qm "md-read: loop iteration $i" 2>/dev/null || true
done
echo "=== verify PASS after $i iteration(s) $(date -Is)" | tee -a loop/LOOP.log
git log --oneline -1; notify "md-read loop: verify PASS after $i iterations on $BRANCH"
