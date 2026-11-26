# Status

- Version 2.3.0 on the Chrome Web Store and AMO.
- The working framework is adopted on branch `overnight/revamp`: brief, gate (`scripts/verify.sh`), unit and e2e suites.
- Header rewriting is limited to the preview's own requests in the previewing tab (Chrome and Firefox); see
  `docs/code/Chrome/background.js.md`.
- A long press loads the preview during the hold and shows it already loaded; hovering links sends no requests
  (`docs/features/performance.md`).
