# Status

- Version 2.3.0 is on the Chrome Web Store and AMO. Branch `overnight/revamp` (not merged) carries the next release; see the
  Unreleased section of `CHANGELOG`.
- The framework is adopted: brief, gate (`scripts/verify.sh`: unit tests, e2e in Chrome for Testing, eslint, structure ratchet, doc
  gates), a code mirror for every source file.
- Header rewriting is limited to the preview's own requests in the previewing tab, holds back cookie rewriting until a preview is
  shown, and survives service-worker restarts without leaking rules (`docs/code/Chrome/background.js.md`).
- A long press loads the preview during the hold; hovering sends no requests (`docs/features/performance.md`).
- The preview and settings follow the system's light or dark appearance unless the user picks one.
- Firefox changes are covered by unit tests only; no run in a real Firefox yet (`docs/todo.md`).
