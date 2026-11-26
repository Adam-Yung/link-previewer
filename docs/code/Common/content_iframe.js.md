# Common/content_iframe.js

Injected into every frame (`all_frames`), active only in the preview iframe, recognised by `window.name === 'link-previewer-frame'`
(set by `ui.js`; a frame's name survives its navigations).

- Links clicked inside the preview reopen in the preview through the host page (`updatePreviewUrl` relayed by the background), so the
  address bar and history stay in step. This hooks `mousedown`, not `click`, so it runs before the previewed site's own click handlers
  (single-page apps would otherwise route inside the frame without telling the address bar).
- **Only a plain primary press** (left button, no modifier) is taken over, and only for http(s) links without `download`. Right-click,
  middle-click and Ctrl/Cmd/Shift/Alt-click keep their browser meaning (context menu, new tab, download). Test: the four
  "... leaves the preview where it is" cases in `tests/e2e/preview.test.mjs`.
- The close key and focus are forwarded to the host page, which owns the preview window.
