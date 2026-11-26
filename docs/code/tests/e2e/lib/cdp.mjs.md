# tests/e2e/lib/cdp.mjs

A small DevTools Protocol client on Node's built-in `WebSocket`, so the e2e suite needs no npm package (Playwright and Puppeteer are
not installed; the brief keeps dependencies small).

- One browser-level connection with flattened sessions: every command can carry a `sessionId`, which is how page, iframe and service
  worker targets are addressed over the same socket.
- `waitFor()` resolves on the first matching event; it rejects on timeout so a hung expectation fails the test instead of the run.
