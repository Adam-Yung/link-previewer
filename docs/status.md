# Status

- Version 2.3.0 on the Chrome Web Store and AMO.
- The working framework is adopted on branch `overnight/revamp`: brief, gate (`scripts/verify.sh`), unit and e2e suites.
- Known bugs, each with a test marked todo until fixed: header rewriting reaches the host page's own requests (Chrome and Firefox);
  links inside the preview hijack right/middle/modifier clicks; a held-and-dragged link opens a preview; modifier-click is swallowed on
  disabled sites; `tools/build.sh clean` deletes every zip in the tree.
