# Firefox/background.js

The MV2 background page. Same job as `Chrome/background.js` with blocking `webRequest` instead of DNR: the listeners are registered
only while at least one tab has a preview open.

- **Invariant (brief priority 1):** `shouldRewrite()` rewrites only requests of a previewing tab: its frames, and XHRs whose
  `originUrl` is outside the host page's domain (the previewed page's own). The host page's XHRs, and every other tab, are untouched.
  With no host hostname, only frames are rewritten. Tests: `tests/unit/firefox-background.test.mjs`. Not run in a real Firefox on
  2026-11-26 (owner allowed Chromium only).
- `isWithinDomain()` matches Chrome's `excludedInitiatorDomains`: the domain and its subdomains.
- `requestHeadersListener` only touches requests the extension itself starts (its `originUrl` is the extension); the preview frame's
  own requests come from the host page and are not spoofed on Firefox.
- A tab that navigates or closes loses its preview; the listeners go when the last preview does.
