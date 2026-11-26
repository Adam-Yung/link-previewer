# tools/build.sh

Assembles one browser's unpacked extension in `out/dist` and zips it to `out/link-previewer-<browser>-v<version>.zip`.

- The directory was `build/` until 2026-11-26; renamed because the owner's permission settings deny `build/` (see
  `docs/decisions/overnight-2026-11-26.md`).
- Order matters: `Common/` first, then the browser folder on top, so `Chrome/` or `Firefox/` files win on a name clash.
- `components/shared.js` is prepended to `background.js` because background scripts cannot list several files the way content scripts
  can in MV3 (`service_worker` takes one file); it carries the message names and `log()`.
- Firefox: every `chrome.` in shipped JS becomes `browser.` (sed). The Firefox background is already written against `browser.`; the
  rewrite is for `Common/`. Never put a literal `chrome.` in a string that must survive a Firefox build.
- `clean` deletes the whole `out/` directory before each build, so a build never mixes files from the other browser. It also deletes
  every `*.zip` anywhere under the repo, including other worktrees (known bug; the test in `tests/unit/build.test.mjs` is marked todo).
- Needs `jq`, `zip` and `rsync`. `-m` makes a minimal build with only the 48px icon.
