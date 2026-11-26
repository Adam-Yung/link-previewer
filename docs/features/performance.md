# Performance

> Verified: 2026-11-26 · Sources: `tests/e2e/measure.mjs`, `Common/content.js`, `Common/components/ui.js`, `Chrome/background.js`

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
