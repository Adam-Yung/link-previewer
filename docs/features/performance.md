# Performance

> Verified: 2026-11-26 13:10 · Sources: `tests/e2e/measure.mjs`, `Common/content.js`, `Common/components/ui.js`, `Common/components/parentPage.js`

Measured with `node tests/e2e/measure.mjs 8` on the real extension in Chrome for Testing (headless, Apple Silicon laptop), against the
local fixture sites. Medians of 8 runs (5 for style cost). Local pages have no DNS or TLS cost, so connection set-up savings do not show
here: they are "not measured", not zero.

## Baseline, version 2.3.0 (`docs/plans/2026-11-26-baseline.json`)
| Measure | Result |
|---------|--------|
| Preview UI shown after mousedown (hold is 500 ms) | 515 ms |
| Header rule ready (iframe `src` set) after the UI | 0–11 ms: the background round trip is not a bottleneck |
| Page loaded, after the hold, fast page | 68 ms |
| Page loaded, after the hold, page whose server takes 400 ms | 434 ms: the wait is the page itself, all of it after the hold |
| Requests sent by hovering 4 links | 4 `HEAD` requests, one per link hovered, before any preview |
| Style recalculation for one open and close, 20,000-node page, pocket mode | 3 ms |
| The same in center stage (pauses every animation on the host page) | 41 ms |

## Now: load during the hold, preconnect from the page (`docs/plans/2026-11-26-after-review.json`)
How it works: 250 ms before the hold ends (never earlier than 300 ms into the press; at the default 500 ms hold, at 300 ms) the
preview is built hidden and the page starts loading; the end of the hold reveals it. Releasing, dragging or moving the mouse first
throws it away and the click proceeds normally. While hidden, the header rules leave cookies alone; the `SameSite=None` rewrite starts
only when the preview is shown. At the start of the press the page also gets a `<link rel="preconnect">` for the link's origin.
Hovering sends nothing.

Same probe on each build: "before" is the branch just before the spike (`acb1fb3`); "first spike" started loading at 150 ms
(`docs/plans/2026-11-26-after-spike.json`); "now" is after the review moved it to 300 ms.
| Measure | Before | First spike | Now |
|---------|--------|-------------|-----|
| Preview on screen after mousedown | 513 ms | 510 ms | 508 ms (it still waits for the hold) |
| Wait after the preview is on screen, fast page | 43 ms | 0 ms | 0 ms: already loaded when shown |
| Wait after the preview is on screen, 400 ms server | 417 ms | 71 ms | 227 ms |
| Requests sent by hovering 4 links | 4 `HEAD` | 0 | 0 |

Why "now" gives back part of the first spike's gain: the review showed that ordinary clicks often last 150 ms or more (trackpads), and
a hidden load during a click is not free (next section). At 300 ms far fewer clicks reach it.

Not measured: the preconnect's saving (local fixtures have no DNS or TLS latency), and real sites. The old hover preconnect ran in
the background service worker, whose connections live in the extension's network partition; the preview iframe is partitioned under
the host page, so it could not have reused them (reasoned from Chrome's network state partitioning, not measured).

## Cost of loading during the hold
A press held from 300 ms to the end of the hold and then released (or dragged) has loaded the linked page once in a hidden frame;
if it was a click, the tab then loads it again. That spends one-time links (magic login, email confirmation, unsubscribe) before
the real navigation, briefly starts autoplay media, and turns the framing-header rules on for that tab while the hidden frame exists.
Cookies are not rewritten during that time. Owner question: is this worth 190 ms on slow pages? Turning it off is one constant
(`SPECULATE_LEAD_MS` in `Common/content.js`).

## Center stage on a large page
Center stage used to pause host-page animations with one `!important` rule over `body *`. It now pauses only the running animations
through the Web Animations API. Style recalculation for one open and close of a 20,000-node page in center stage: 41–42 ms before,
29 ms after (median of 5). What remains is mostly `pointer-events: none` on `body`, which is inherited by every element.
