#!/usr/bin/env bash
# Dev-only dependencies, pinned and installed with lifecycle scripts off. Dry run unless --run.
# The shipped extension has no runtime dependencies; everything here is for the gate (lint).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

PACKAGES=(
  "eslint@10.13.0"   # lint + structure ratchet (max-depth / complexity) in scripts/verify.sh
)

cmd=(npm install --save-dev --save-exact --ignore-scripts "${PACKAGES[@]}")
if [[ ${1:-} != --run ]]; then
  echo "dry run: ${cmd[*]}"
  echo "pass --run to execute"
  exit 0
fi
"${cmd[@]}"
