# tests/e2e/lib/harness.mjs

Shared e2e setup: builds the Chrome target with `tools/build.sh` (skip with `LP_SKIP_BUILD=1`), starts the fixtures and the browser, and
gives tests the probes they read (`previewState`, `waitUntil`, `clearStorage`).

- `previewState()` reads the preview's open shadow root from the page world; the shadow root is open, so the page can see it too.
- `HOLD_MS` mirrors the extension's default long-press duration; tests hold a little longer to be safe.
