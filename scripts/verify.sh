#!/usr/bin/env bash
# The commit gate: tests, lint, structure ratchet, docs. Every step must pass; prints GATE-OK last. Run through
# ~/.claude-personal/framework/bin/gate so the commit hook can reuse the pass. Offline: e2e uses local fixture sites only.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
FW="${CLAUDE_FRAMEWORK:-$HOME/.claude-personal/framework}"
[[ -d $FW/gate ]] || { echo "framework not found at $FW (set CLAUDE_FRAMEWORK)" >&2; exit 1; }
[[ -x node_modules/.bin/eslint ]] || { echo "eslint missing: run scripts/owner/install-deps.sh --run (or npm ci)" >&2; exit 1; }

echo "== unit tests"
node --test 'tests/unit/*.test.mjs'

echo "== e2e (real extension in Chrome for Testing)"
# Skipping is an explicit choice (LP_NO_E2E=1), never a silent fallback when the browser is missing.
if [[ ${LP_NO_E2E:-} == 1 ]]; then
  echo "SKIPPED by LP_NO_E2E=1"
else
  node --test --test-concurrency=1 --test-timeout=60000 'tests/e2e/*.test.mjs'
fi

echo "== lint"
./node_modules/.bin/eslint .

echo "== structure ratchet (touched files)"
files=$("$FW/gate/touched.sh" js mjs)
[[ -z $files ]] || ./node_modules/.bin/eslint --rule '{"max-depth": ["error", 3], "complexity": ["error", 12]}' $files

echo "== docs"
python3 "$FW/gate/docgate.py" check .

echo GATE-OK
