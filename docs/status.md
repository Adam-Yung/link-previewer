# Status

- Version 2.3.0 on the Chrome Web Store and AMO.
- The working framework is adopted on branch `overnight/revamp`: brief, gate (`scripts/verify.sh`), unit and e2e suites.
- Header rewriting is limited to the preview's own requests in the previewing tab (Chrome and Firefox); see
  `docs/code/Chrome/background.js.md`.
- Known bugs, each with a test marked todo until fixed: links inside the preview hijack right/middle/modifier clicks; a held-and-dragged link opens a preview; modifier-click is swallowed on
  disabled sites.
