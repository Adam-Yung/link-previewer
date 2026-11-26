# tests/e2e/lib/cdp.mjs

A small DevTools Protocol client over Chrome's `--remote-debugging-pipe` (fd 3 in, fd 4 out, NUL-terminated JSON), so the e2e suite
needs no npm package (Playwright and Puppeteer are
not installed; the brief keeps dependencies small). The pipe, not a debugging port, is what Chrome requires before it offers
`Extensions.loadUnpacked`.

- One browser-level connection with flattened sessions: every command can carry a `sessionId`, which is how page, iframe and service
  worker targets are addressed over the same pipe.
- `waitFor()` resolves on the first matching event; it rejects on timeout so a hung expectation fails the test instead of the run.
