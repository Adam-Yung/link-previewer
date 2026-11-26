# tests/helpers/sandbox.mjs

Runs the extension's classic scripts in a `node:vm` context so unit tests exercise the shipped files, not copies.

- Several files are concatenated into one script because content scripts share one scope per frame; top-level `const`, `let` and
  `class` are lexical, not global properties, so the caller names the bindings it wants and the loader returns them.
- Objects created inside the context come from another realm: compare them with loose `assert.deepEqual` (node:assert), not the strict
  variant, which also compares prototypes.
- The fake extension API records calls (`updateSessionRules`, `tabs.sendMessage`, `fetch`) and exposes `fire()` on every event so a test
  can play the browser. `chrome` and `browser` are the same object.
- `flush()` lets the Chrome background's serialized rule-update promise chain run before a test reads the recorded rules.
