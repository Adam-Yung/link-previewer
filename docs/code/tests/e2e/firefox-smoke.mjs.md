# tests/e2e/firefox-smoke.mjs

The Firefox counterpart of the Chrome e2e suite, smaller and outside the gate (it needs a Firefox install and rebuilds `out/dist` as
the Firefox target). Plain script with PASS/FAIL lines and a non-zero exit on any failure, not a `node:test` file, so `npm run e2e`
does not pick it up.

- Drives Firefox over WebDriver BiDi with Node's built-in WebSocket: `webExtension.install` loads the unpacked MV2 build as a
  temporary add-on, which needs no signing. Input is real (`input.performActions`), not synthetic page events.
- `network.dns.localDomains` maps the fixture hosts to 127.0.0.1 and `acceptInsecureCerts` accepts the fixtures' self-signed
  certificate, the Firefox equivalents of the Chrome suite's flags.
- BiDi input aimed at the top-level context stops at a cross-origin (out-of-process) iframe element; the event never reaches the
  frame. The in-preview click is therefore sent to the frame's own context. That click navigates the preview and the context is
  replaced mid-action, so the error from that call is ignored and the result is judged by the frame's new title.
- First run: Firefox 159.0.1 on prisma-vm, 8/8 (2026-11-26).
