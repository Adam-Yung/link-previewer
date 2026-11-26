# Common/components/ui.js

Builds, navigates and closes the preview window.

- **Two-step open.** `createPreview(url, { hidden: true })` builds everything and starts the load while showing nothing: the overlay
  and host are `visibility: hidden` (not hit-tested, so the click the user may still be making reaches the page) and the fade-in is
  held. `revealPreview()` shows it and only then takes over the host page (close key, center-stage dimming).
  `discardSpeculativePreview()` removes an unrevealed preview and clears the header rules. `createPreview(url)` without `hidden`
  builds and shows at once. `state.isSpeculative` is true from build to reveal, and is sent with `prepareToPreview` so the background
  holds back the cookie rewrite until the reveal asks for the full rules.
- `closePreview()` clears `isSpeculative` and the long-press timer, so a preview closed while hidden (Escape inside the frame) can
  never be revealed afterwards onto a page it would lock.
- A lost extension context (`prepareToPreview` fails) is reported when the user can see it: at once for a shown preview, at reveal for
  a hidden one, never for one already discarded.
- Nothing is built on a page without `document.body` (framesets, XML), so `state.isPreviewing` cannot get stuck.

- The window lives in an open shadow root on `#link-preview-host`, so page CSS cannot reach it; the page overlay is outside the shadow
  root because it must cover the page's own stacking contexts.
- The iframe is named `link-previewer-frame`; `content_iframe.js` uses the name to know it is inside a preview.
- `prepareToPreview` must be answered before `src` is set: the background installs the header rules first, or the framed page is
  refused by its own X-Frame-Options.
- Same-document navigation (only the hash differs) updates `src` in place instead of rebuilding the iframe.
- Image URLs (by extension) render as `<img>`; if that fails, the URL is retried as a page.
- The loading bar shows for at least one second so a fast load does not flicker.
- Closing fades out, then removes the elements and tells the background (`clearPreview`) so the header rules go.
- The close key is matched with `isCloseKey()` (`shared.js`).
