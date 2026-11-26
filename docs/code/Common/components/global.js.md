# Common/components/global.js

The top frame's shared mutable state (`state`), the settings defaults (`settings`, overwritten from storage by `settings.js`), and
`timeoutWrapper()`.

- `settings` keys must match what `options.js` saves; a key missing here is ignored when storage changes (`settings.js` copies only
  known keys).
- `state.isPreviewing` is true from the moment a preview is built, hidden or shown, until its close animation starts;
  `state.isSpeculative` is true only while a built preview is not yet shown (see `docs/code/Common/components/ui.js.md`).
- `timeoutWrapper()` debounces per wrapped function: the function itself is the timer key, so two wrappers of one function share a
  timer.
