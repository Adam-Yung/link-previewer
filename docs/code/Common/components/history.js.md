# Common/components/history.js

`HistoryManager`: back, forward and copy for the preview's own history, separate from the tab's.

- Navigating from a point in the past drops the forward entries, as a browser does. The list keeps the newest 50 entries.
- The navigation callback gets `(url, previousUrl, false)`; `false` tells `navigateTo` not to add a history entry for a back/forward step.
- Copy shows a tick for 1.5 s, or a failed state for 2 s when the clipboard refuses (pages without clipboard permission in some
  browsers). Tests: `tests/unit/history.test.mjs`.
