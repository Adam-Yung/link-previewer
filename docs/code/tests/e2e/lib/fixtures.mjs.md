# tests/e2e/lib/fixtures.mjs

One HTTPS server for every fixture host, routed by path, with a throwaway self-signed certificate made by `openssl` at start-up.

- Target pages send `X-Frame-Options: DENY`, `frame-ancestors 'none'` and COOP, so a preview only renders if the extension's header
  rewriting works.
- `/api/headers` is the host page's own endpoint with CORP and `nosniff`; `window.headerProbe()` on the host page reads them back, which
  is how the suite proves the host page's requests are not rewritten.
- `?nodes=N` on the host page adds N rows with transitions, for the style-cost measurement.
- `requests` logs every request (method, host, path, time); the measurement counts what hovering sends.
- `close()` also drops keep-alive connections; without that `server.close()` waits for Chrome's idle sockets and the run hangs.
