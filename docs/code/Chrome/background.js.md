# Chrome/background.js

The MV3 service worker. It turns header rewriting on for exactly the tabs that have a preview open, and relays messages between the
preview iframe and the page hosting it. `components/shared.js` (message names, `log`) is prepended by `tools/build.sh`.

## Header rules
- Built from `previewingTabs` (tab id → hostname of the host page) on every change and installed as session rules. Each rebuild
  removes every installed session rule (read with `getSessionRules`), because session rules outlive a service-worker restart while
  in-memory bookkeeping does not; an earlier draft kept the ids in memory, and after a restart its update failed on a duplicate id and
  left a closed preview's rules on (test: the restart cases in `tests/unit/chrome-background.test.mjs`).
- Per tab, two `sub_frame` rules (response: drop framing and isolation headers, sandbox CSP, `SameSite=None` on cookies; request: fetch
  metadata that looks like a top-level navigation) and one subresource rule for the previewed page's own XHR, scripts, styles, images
  and fonts.
- A preview still hidden (loading during the hold, `speculative`) gets the same rules without the cookie rewrite: it may be an
  ordinary click, and a downgraded cookie outlives the preview. The reveal sends `prepareToPreview` again to add it.
- **Invariant (brief priority 1):** the subresource rule carries `excludedInitiatorDomains: [host]`, so nothing the host page itself
  requests is rewritten. With no hostname (a `file:` page, an IPv6 literal that DNR would reject) the subresource rule is left out: fail
  closed. Tests:
  `tests/unit/chrome-background.test.mjs`, and "host page headers untouched" in `tests/e2e/preview.test.mjs`.
- Known residue: DNR has no frame condition, so while a preview is open the `sub_frame` rules also apply to the host page's other
  iframes, in that tab only, and the subresource rule applies to requests those iframes start (ads, widgets, embeds: their initiator
  is their own domain, not the host's). Excluding by initiator is impossible for the `sub_frame` rules because the preview iframe's
  initiator is the host page.
- A previewed page on the same site as the host keeps its own subresource headers (they are excluded with the host); it needs no
  rewriting there because its cookies are first-party.

## Lifecycle
- `previewingTabs` is mirrored to `chrome.storage.session` because the worker can stop while a preview is open. The restore is
  asynchronous and the worker may have been woken by the very event that ends the preview, so every handler waits for `restored`
  first; `prepareToPreview` is therefore answered asynchronously.
- Rule updates are chained on one promise so a slow update can never land after a newer one.
- A tab that navigates (`tabs.onUpdated` with a `url`) or closes loses its preview and its rules.
