# Common/components/parentPage.js

Takes the host page out of play while a preview is in center stage, and gives it back.

- Center stage sets `pointer-events: none` on the page body, dims it with the overlay, and pauses the page's running animations
  through the Web Animations API, resuming exactly those on the way out. The preview's own animations and the overlay's fade are left
  alone. The earlier `body *` `!important` rule restyled every element on open and close (`docs/features/performance.md`). Test: the
  center-stage case in `tests/e2e/preview.test.mjs`.
- Teardown uses non-throwing lookups because it also runs after the elements are gone; the enable path throws on a missing element,
  since that means the preview was built wrong.
- `scrollLock()` remembers the page's own `overflow` value and restores exactly that.
