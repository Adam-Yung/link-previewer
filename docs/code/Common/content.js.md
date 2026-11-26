# Common/content.js

The host page's triggers. Loaded last in the top frame's content scripts, so `state`, `settings` and `createPreview` exist.

- Listeners are on `document` in the capture phase so they run before the page's own handlers.
- **Long press:** left button only. The timer is cancelled by release, by a drag (`dragstart`) and by moving more than
  `LONG_PRESS_SLOP_PX` (8 px), so dragging a link or selecting text across it never opens a preview.
- **Loading during the hold:** after `SPECULATE_AFTER_MS` (150 ms) of a still press the preview is built hidden and starts loading;
  the long-press timer reveals it. Every way a press ends early (release, drag, movement) goes through `cancelLongPress()`, which
  discards it, so an ordinary click is never caught. Skipped when the hold setting is under 300 ms. Numbers:
  `docs/features/performance.md`.
- **Preconnect:** the press adds a `<link rel="preconnect">` for the link's origin to the page (removed after 10 s). It runs in the
  page, not the background, so the connection is in the same network partition as the preview iframe. Hovering sends nothing.
- **Modifier + click** opens at once on mousedown; the matching `click` is swallowed so the browser does not also open the link.
- **Disabled site:** nothing is intercepted, the `click` included, so Shift/Ctrl/Cmd-click keep their browser meaning there.
- While a preview is open, a link pressed on the host page retargets the preview instead of navigating the tab.
- Tests: the trigger cases in `tests/e2e/preview.test.mjs` (short click, drag, middle button, disabled site).
