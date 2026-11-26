# tests/e2e/measure.mjs

The performance spike's instrument. Not in the gate because timings vary by machine; results are recorded in
`docs/features/performance.md`.

- Times are taken in the host page's own clock (`performance.now()`) from the mousedown, via a page-world probe that watches for the
  preview host, the iframe's `src` and its `load` event. "After hold" subtracts the long-press duration: it is what the user waits once
  the preview is due.
- Hover requests are counted at the fixture server, so they include requests the extension's background sends.
- Style cost uses `Performance.getMetrics` deltas (`RecalcStyleDuration`, `LayoutDuration`) across one open and close on a 20,000-node page.
