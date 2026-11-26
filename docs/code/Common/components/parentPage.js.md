# Common/components/parentPage.js

Takes the host page out of play while a preview is in center stage, and gives it back.

- Center stage sets `pointer-events: none` on the page body, dims it with the overlay, and pauses its animations and transitions with
  one injected style rule. That rule costs a full style recalculation on big pages (`docs/features/performance.md`).
- Teardown uses non-throwing lookups because it also runs after the elements are gone; the enable path throws on a missing element,
  since that means the preview was built wrong.
- `scrollLock()` remembers the page's own `overflow` value and restores exactly that.
