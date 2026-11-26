# scripts/verify.sh

The commit gate. Steps in order: unit tests, e2e in Chrome for Testing, whole-repo lint, the structure ratchet on touched JS, doc gates.

- e2e is part of the gate because the bugs that matter here (header leaks, click handling) only show in a real browser. Skipping it is
  explicit (`LP_NO_E2E=1`) so a missing browser can never pass the gate silently.
- eslint must come from `node_modules` (never `npx`, which downloads what is missing). Install it with `scripts/owner/install-deps.sh`.
- The ratchet (`max-depth` 3, `complexity` 12) runs only on files the change touches; untouched legacy waits.
