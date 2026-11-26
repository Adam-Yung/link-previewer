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

## 2026-11-26 · Header rewriting excludes the host page's own requests
Measured before the fix: with a preview open, the host page's own same-origin `fetch` lost `Cross-Origin-Resource-Policy` and
`X-Content-Type-Options`, and its cookies were rewritten to `SameSite=None` (Chrome); on Firefox every XHR in every tab was rewritten
while any preview was open. That breaks brief priority 1.
Weighed: (a) drop subresource rewriting entirely (simplest; may break logins and consent cookies inside the preview, priority 2);
(b) per-URL rules for the previewed page (breaks on redirects, which are common on search results); **(c) per-tab rules whose
subresource part excludes the host page's domain as initiator**. (c) keeps what the previewed page needs and stops the leak.
Kept as the owner built it: `sub_frame` rewriting for the whole previewing tab, and `SameSite=None` on cookies set inside the preview
(owner design; listed as a question in the handoff). Reverse: `git revert` the commit.

## 2026-11-26 · Performance spike: load during the hold, preconnect from the page, no hover requests
Baseline: the background round trip that installs header rules takes 0–11 ms, so it is not worth optimizing; the user's wait is the page
load, which only started after the 500 ms hold. Hovering sent a `HEAD` request to every link, from the background, where the
connection could not be reused by the preview (network partitioning).
Weighed: (a) pre-arm the header rule at mousedown (saves ~10 ms, widens when rules are active); (b) prefetch on hover (requests for
links never pressed: privacy); **(c) build the preview hidden after a 150 ms still press and reveal it at the hold's end, with an
in-page preconnect at press start and no hover requests.** (c) cut the wait after the preview appears from 417 ms to 71 ms on a slow
page and to 0 on a fast one, and hovering now sends nothing.
Trade-off accepted: a press held 150–500 ms that is then released loads the page once in a hidden frame before the tab navigates to
it; header rules are on for that tab while the hidden preview exists (it is a preview, just not shown; discarded on release).
Reverse: set `SPECULATE_AFTER_MS` above any hold (or remove the speculate timer in `Common/content.js`); the hover preconnect is in git
history (`acb1fb3`).

## 2026-11-26 · Firefox `requestHeadersListener` kept
With the background no longer fetching, this listener may be dead code, or it may be what spoofs the preview iframe's request headers
on Firefox (if Firefox attributes the content script's iframe load to the extension). Cannot check tonight (no Firefox run allowed), so
it stays. Question for the owner in the handoff.

## 2026-11-26 · Theme defaults to the system appearance
The README promises a theme that "adapts to your system's theme", but the only values were `light` (default) and `dark`. Added `auto`
as the default; anyone who saved settings keeps their stored `light` or `dark`. Weighed a three-way control in the settings popup
(more UI for a rare need) against keeping `auto` implicit until the switch is flipped; chose the latter. Reverse: default back to
`light` in `global.js` and `options.js`.

## 2026-11-26 · Reviewer findings: loading during the hold made later and cookie-safe
The reviewer showed the 150 ms start caught ordinary clicks (trackpad clicks often last longer), and on those clicks the header rules
appended `SameSite=None` to the linked site's cookies, a downgrade that outlives the preview: against the brief's anti-goal. Fixed
fail-closed: a hidden preview gets no cookie rewrite (added at reveal), and loading starts 250 ms before the hold ends, never before
300 ms. Wait on a 400 ms page: 227 ms (first spike 71, before 417). Residual cost (one-time links spent by a 300 ms+ click, a brief
hidden autoplay) is an owner question in the handoff. Also fixed from the review: rules surviving a worker restart (security),
a hidden preview closed from inside being revealed later, a context-expired popup during a click, IPv6 hosts, SVG links, pages
without a body. Not fixed (recorded): an SPA host changing its URL with `pushState` while a preview is open ends the preview's header
rules; telling `pushState` from a real navigation needs a Chrome run of its own (`docs/todo.md`).

## 2026-11-26 · pushState on the host page no longer ends a preview (Chrome)
Measured in Chrome for Testing: `pushState`, a hash change and a real navigation all reach `tabs.onUpdated` as `{status: 'loading',
url}`, so the event alone cannot tell them apart. Weighed: the `webNavigation` permission (`onHistoryStateUpdated`; a new permission
users must accept on update), ending previews from the content script on `pagehide` (misses a dead context, so rules could linger:
not fail-closed), and **asking the document that opened the preview by `documentId`** (no new permission; a replaced document cannot
answer, so the default is to end the preview). Chose the last. Firefox keeps ending the preview on any URL change.
