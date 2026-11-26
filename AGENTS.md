# Link Previewer: rules for this repo

Project-specific rules only. The general working rules (triage, docs with code, commit gate, structure ratchet) come from
`~/.claude-personal/CLAUDE.md`; do not copy them here.

## Start here
1. `docs/brief.md`: what this project is for and what wins a conflict.
2. `docs/status.md`: where things stand.
3. `docs/decisions/`: the topic files relevant to the task. Settled calls are not reopened without new evidence.

## Stack and commands
Plain browser scripts, no bundler, no runtime dependencies. `Common/` is shared; `Chrome/` and `Firefox/` hold each browser's manifest
and background script. Content scripts share one global scope per frame, in the order the manifest lists them.
- Build: `npm run build chrome` or `npm run build firefox` (`tools/build.sh`); output in `out/dist` and `out/*.zip`.
- Tests: `npm test` (unit, `node --test`), `npm run e2e` (real Chrome for Testing, local HTTPS fixtures). See `docs/guides/testing.md`.
- Gate: `scripts/verify.sh`, run through `~/.claude-personal/framework/bin/gate`.

## Invariants
- Header rewriting (CSP, X-Frame-Options, COOP/COEP/CORP, Set-Cookie) applies only while a preview is open, only in that tab, and never
  to the host page's own requests. Tests: `tests/unit/chrome-background.test.mjs`, `tests/unit/firefox-background.test.mjs`,
  `tests/e2e/preview.test.mjs` ("host page headers untouched").
- Firefox builds rewrite `chrome.` to `browser.` with sed (`tools/build.sh`); never write `chrome.` inside a string that must survive.
- `background.js` gets `Common/components/shared.js` prepended at build time; the message names live there only.
- No AI features, no telemetry (brief, non-goals).
