# Common/components/shared.js

What every context shares: the message names, `isCloseKey()` and the `log()` helper. Loaded in every frame by the second content-script
entry and prepended to `background.js` by `tools/build.sh`, so it must not touch the DOM or `window` at load time.

- Message names are the one list both sides agree on; add a message here, never as a string literal elsewhere.
- `isCloseKey()`: the settings page stores the space bar as `Space`, `KeyboardEvent.key` says `' '`. Test: `tests/unit/close-key.test.mjs`.
- `log()` is silent unless `ALLOW_DEBUGGING` is true; it walks the stack to print the caller's file and line (V8 and Gecko formats).
