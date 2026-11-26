# Testing

> Verified: 2026-11-26 · Sources: `scripts/verify.sh`, `tests/helpers/sandbox.mjs`, `tests/e2e/lib/browser.mjs`, `tests/e2e/lib/harness.mjs`, `tests/e2e/measure.mjs`, `package.json`

Everything runs offline against local pages; nothing is downloaded at test time.

## One-time setup
- `scripts/owner/install-deps.sh --run` installs the linter (dev only).
- e2e needs Chrome for Testing. It is found in the Playwright cache (`~/Library/Caches/ms-playwright/chromium-*`), or set `LP_CHROME`
  to the binary. It runs headless with a throwaway profile.

## Commands
| Command | What it runs |
|---------|--------------|
| `npm test` | Unit tests (`tests/unit/`): the shipped scripts loaded into a sandbox with a fake extension API, plus the build script in a scratch copy |
| `npm run e2e` | Builds the Chrome target, then drives the real extension over CDP against local HTTPS fixtures (`tests/e2e/`) |
| `node tests/e2e/measure.mjs 8` | The performance measurement; prints JSON (see `docs/features/performance.md`) |
| `~/.claude-personal/framework/bin/gate` | `scripts/verify.sh`: unit, e2e, lint, structure ratchet, doc gates |

`LP_NO_E2E=1` skips e2e in the gate on purpose (say why in the commit). `LP_SKIP_BUILD=1` reuses `out/dist`.

## Writing tests
- A unit test loads the real files: `loadScripts(['Common/components/shared.js', 'Chrome/background.js'], ['message'])`.
- An e2e test that asserts "nothing happened" must first prove the extension is live in that frame (`frame.extensionWorld()`), or it
  passes for the wrong reason.
- Inside the cross-site preview frame, send input as page-world events (see `pressInFrame` in `tests/e2e/preview.test.mjs`); real
  right-clicks open a context menu that blocks headless input.
