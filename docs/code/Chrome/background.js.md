# Chrome/background.js

The MV3 service worker. It turns header rewriting on for exactly the tabs that have a preview open, and relays messages between the
preview iframe and the page hosting it. `components/shared.js` (message names, `log`) is prepended by `tools/build.sh`.

## Header rules
- Built from `previewingTabs` (tab id → hostname of the host page) on every change and installed as session rules; the ids of the last
  install are kept so the next one removes exactly those (plus ids 1 and 2 from versions before 2.4, which used fixed ids).
- Per tab, two `sub_frame` rules (response: drop framing and isolation headers, sandbox CSP, `SameSite=None` on cookies; request: fetch
  metadata that looks like a top-level navigation) and one subresource rule for the previewed page's own XHR, scripts, styles, images
  and fonts.
- **Invariant (brief priority 1):** the subresource rule carries `excludedInitiatorDomains: [host]`, so nothing the host page itself
  requests is rewritten. With no hostname (a `file:` page) the subresource rule is left out: fail closed. Tests:
  `tests/unit/chrome-background.test.mjs`, and "host page headers untouched" in `tests/e2e/preview.test.mjs`.
- Known residue: DNR has no frame condition, so while a preview is open the `sub_frame` rules also apply to the host page's other
  iframes, in that tab only. Excluding by initiator is impossible there because the preview iframe's initiator is the host page.
- A previewed page on the same site as the host keeps its own subresource headers (they are excluded with the host); it needs no
  rewriting there because its cookies are first-party.

## Lifecycle
- `previewingTabs` is mirrored to `chrome.storage.session` because the worker can stop while a preview is open; it is restored at start.
- Rule updates are chained on one promise so a slow update can never land after a newer one.
- A tab that navigates (`tabs.onUpdated` with a `url`) or closes loses its preview and its rules.
