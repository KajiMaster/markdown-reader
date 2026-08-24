#!/usr/bin/env bash
# verify.sh — the mechanical "done" for the build loop. Exit 0 ⇔ done. Hard to game:
# tests are fixed, fixtures are fixed, and a real build must succeed.
set -uo pipefail
cd "$(dirname "$0")" || exit 1
fail=0
echo "== 1/3 tests"; npm test -- --run 2>&1 | tail -25 || fail=1
[ "${PIPESTATUS[0]}" -eq 0 ] || fail=1
echo "== 2/3 frontend build"; npm run build 2>&1 | tail -5 || fail=1
[ "${PIPESTATUS[0]}" -eq 0 ] || fail=1
echo "== 3/3 rust check"; if command -v cargo >/dev/null; then (cd src-tauri && cargo check --quiet 2>&1 | tail -10); [ "${PIPESTATUS[0]}" -eq 0 ] || fail=1; else echo "cargo missing — skipped (counts as FAIL on the seat)"; fail=1; fi
# Optional headless smoke: only when xvfb + a built binary exist; never required for exit 0 yet.
echo "== result: $([ $fail -eq 0 ] && echo PASS || echo FAIL)"; exit $fail
