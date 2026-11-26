# Overnight revamp, 2026-11-26

Decisions taken during the unattended run. Each: what, why, how to reverse. Items marked **Owner** were answered by the owner at the
start of the run.

## 2026-11-26 · Brief approved as drafted (Owner)
`docs/brief.md` was drafted from the README; the owner approved the priority order at the start of the run.

## 2026-11-26 · `build/` renamed to `tools/` (Owner)
The owner's permission settings deny reading `build/`; the owner ordered the rename. `package.json` scripts point at `tools/build.sh`.
Reverse: `git mv tools build` and restore the two script paths.

## 2026-11-26 · ESLint 10.13.0 as a dev dependency (Owner)
The owner told the run to install it. 10.13.0 (2026-10-16) is the newest release at least 30 days old; installed with
`--ignore-scripts` through `scripts/owner/install-deps.sh`. `npm audit`: 2 moderate (minimatch ReDoS, GHSA-g3hv-75wg-m249) inside
eslint itself; the fix is eslint 10.15.0, only 13 days old, so it waits. Dev-only: nothing ships in the extension.

## 2026-11-26 · Real-browser checks: Chrome for Testing + local pages only (Owner)
Only the cached Playwright "Google Chrome for Testing" with a throwaway profile, driven over CDP, against local HTTPS fixture pages.
No Firefox run, no public sites. Firefox changes are covered by unit tests only and flagged "not run in Firefox".

## 2026-11-26 · Plan approach C
See `docs/plans/2026-11-26-revamp-PLAN.md`: keep plain scripts, dependency-free harness, verified small fixes.

## 2026-11-26 · Test harness without new packages
Unit tests load the shipped classic scripts into `node:vm` with a fake extension API; e2e drives Chrome for Testing over a ~60-line CDP
client on Node's built-in WebSocket. Weighed: Playwright or Puppeteer (one more dev dependency each and a browser download path), jsdom
(no real network, no header rules, misses the bugs that matter). Reverse: swap `tests/e2e/lib/browser.mjs` for Playwright.

## 2026-11-26 · e2e runs inside the gate
The bugs this extension has are only visible in a real browser, so `scripts/verify.sh` runs e2e (about 20 s). Skipping is explicit
(`LP_NO_E2E=1`), never automatic when the browser is missing: fail closed. Reverse: drop the step.

## 2026-11-26 · Known bugs land as todo tests first
Each bug found tonight got its failing test in the adoption commit, marked `todo`, so the gate passes; each fix commit removes the
marker. The test output of the adoption commit is the "fails without the fix" evidence.

## 2026-11-26 · Mirrors grow with the files they describe
`.framework.json` requires mirrors only for files that have one; `Common/`, `Chrome/` and `Firefox/` join once their files are
reworked tonight, so a mirror is written once, for the code as it ends up.

## 2026-11-26 · README skipped by the link check
The doc gate reads `docs/...` inside the Chrome Web Store badge URL as a repo path. README.md is skipped by the link check
(`.framework.json`); it links to no repo docs today. Reverse: remove it from `links.skip` if README starts linking docs.
