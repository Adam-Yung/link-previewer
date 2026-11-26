# Plan: framework revamp + performance/UX spike (overnight 2026-11-26)

Branch `overnight/revamp`. Nothing pushed or merged.

## Goal as the owner would demo it
1. `~/.claude-personal/framework/bin/gate` passes: unit tests, lint, structure ratchet, a real-Chromium end-to-end run, doc gates.
2. Every source file has a `docs/code/` mirror; `docs/brief.md`, `docs/status.md`, `docs/todo.md`, decisions and guides exist.
3. A measured list of performance and UX problems, the worst fixed on the branch, each with a test that fails without the fix, and
   before/after numbers from the real extension loaded in Chromium.

## Approaches weighed
| Approach | Risk | Fit with brief |
|----------|------|----------------|
| A. Docs and gate only, no code changes | none | misses "improve performance and UX" |
| B. Rewrite into ES modules + bundler | high: new build step, every file changes, Firefox MV2 content scripts cannot be modules | breaks "small, dependency-free" and risks parity |
| **C. Keep plain scripts; add a dependency-free test harness (node:vm for logic, raw CDP against Chrome for Testing for the real thing); fix measured problems one verified commit at a time** | low: each change is small and proven | fits all five priorities |

Pick: **C**.

## Milestones (each ends verified and committed)
1. Framework: brief, docs skeleton, `scripts/verify.sh`, `.framework.json`, eslint (dev only), `build/` renamed to `tools/` (owner order).
2. Test harness: `node --test` unit tests that load the plain scripts into a sandbox with a fake extension API; e2e harness that builds
   the Chrome extension, launches Chrome for Testing (throwaway profile, headless) and drives it over CDP against local HTTPS fixtures.
3. Baseline measurements on the unmodified code (time to preview, header leakage, click behaviour).
4. Security fix first (brief priority 1): header stripping limited to the preview's requests, not the host page's own; Firefox the same.
5. UX bug fixes found in the investigation, each with a failing test first.
6. Performance spike: warm the header rule and the connection during the long press; drop the hover-preconnect from the background.
7. Doc mirrors for every source file; guides for build/test; status/todo; reviewer pass; fixes; handoff.

## Stretch
- Theme follows the system (`auto`) by default, as the README promises.
- Accessibility: aria labels, focus moves into the preview and back on close.
- Firefox parity checks (no Firefox run tonight: owner allowed Chromium only).
