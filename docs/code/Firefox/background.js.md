# Firefox/background.js

The MV2 background page. Same job as `Chrome/background.js` with blocking `webRequest` instead of DNR: the listeners are registered
only while at least one tab has a preview open.

- **Invariant (brief priority 1):** `shouldRewrite()` rewrites only requests of a previewing tab: its frames, and XHRs whose
  `originUrl` is outside the host page's domain (the previewed page's own). The host page's XHRs, and every other tab, are untouched.
  With no host hostname, only frames are rewritten. Residue as on Chrome: the host page's other iframes, and XHRs they start, are
  rewritten while a preview is open in that tab. Tests: `tests/unit/firefox-background.test.mjs`. Not run in a real Firefox on
  2026-11-26 (owner allowed Chromium only).
- A hidden (speculative) preview gets no `SameSite=None` cookie rewrite, as on Chrome.
- `isWithinDomain()` matches Chrome's `excludedInitiatorDomains`: the domain and its subdomains.
- `requestHeadersListener` spoofs Origin, Referer and fetch metadata on requests whose `originUrl` is the extension. Since the hover
  preconnect is gone the background starts no requests, so what remains is whatever Firefox attributes to the content script, possibly
  the preview iframe it creates. Not verified in Firefox (2026-11-26); kept so Firefox previews cannot regress unseen.
- A tab that navigates or closes loses its preview; the listeners go when the last preview does.
