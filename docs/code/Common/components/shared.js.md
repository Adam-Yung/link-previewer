# Common/components/shared.js

What every context shares: the message names, `isCloseKey()`, `resolveTheme()` and the `log()` helper. Loaded in every frame by the
second content-script entry, by the settings page, and prepended to `background.js` by `tools/build.sh`, so it must not touch the DOM
or `window` at load time (the service worker has neither).

- Message names are the one list both sides agree on; add a message here, never as a string literal elsewhere.
- `isCloseKey()`: the settings page stores the space bar as `Space`, `KeyboardEvent.key` says `' '`. Test: `tests/unit/close-key.test.mjs`.
- `resolveTheme()`: `auto`, the default, follows `prefers-color-scheme` at the moment a preview or popup is built; the README has always
  promised the system theme. Tests: `tests/unit/theme.test.mjs`, the dark-appearance case in `tests/e2e/preview.test.mjs`.
- `log()` is silent unless `ALLOW_DEBUGGING` is true; it walks the stack to print the caller's file and line (V8 and Gecko formats).
