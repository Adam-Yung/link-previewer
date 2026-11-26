# Testing

> Verified: 2026-11-26 15:33 · Sources: `scripts/verify.sh`, `tests/helpers/sandbox.mjs`, `tests/e2e/lib/browser.mjs`, `tests/e2e/lib/harness.mjs`, `tests/e2e/measure.mjs`, `tests/e2e/firefox-smoke.mjs`, `package.json`

Everything runs offline against local pages; nothing is downloaded at test time.

## One-time setup
- `scripts/owner/install-deps.sh --run` installs the linter (dev only).
- e2e needs Chrome for Testing. It is found in the Playwright cache (`~/Library/Caches/ms-playwright/chromium-*`), or set `LP_CHROME`
  to the binary. It runs headless with a throwaway profile. Branded Google Chrome ignores `--load-extension`, so it cannot stand in.
- The Firefox smoke test needs an installed Firefox (`/Applications/Firefox.app`, or `LP_FIREFOX`); headless, throwaway profile.

## Commands
| Command | What it runs |
|---------|--------------|
| `npm test` | Unit tests (`tests/unit/`): the shipped scripts loaded into a sandbox with a fake extension API, plus the build script in a scratch copy |
| `npm run e2e` | Builds the Chrome target, then drives the real extension over CDP against local HTTPS fixtures (`tests/e2e/`) |
| `npm run e2e:firefox` | Builds the Firefox target into `out/dist` (replacing the Chrome one) and drives it in Firefox over WebDriver BiDi: open, load a frame-forbidding page, host headers intact, navigate inside, close, shift+click, short click, drag. Not in the gate |
| `node tests/e2e/measure.mjs 8` | The performance measurement; prints JSON (see `docs/features/performance.md`) |
| `~/.claude-personal/framework/bin/gate` | `scripts/verify.sh`: unit, e2e, lint, structure ratchet, doc gates |

`LP_NO_E2E=1` skips e2e in the gate on purpose (say why in the commit). `LP_SKIP_BUILD=1` reuses `out/dist`.

## Writing tests
- A unit test loads the real files: `loadScripts(['Common/components/shared.js', 'Chrome/background.js'], ['message'])`. Passing the
  same `persisted` object (4th argument) to a second load simulates a service-worker restart: session storage and session rules carry
  over, memory does not.
- An e2e test that asserts "nothing happened" must first prove the extension is live in that frame (`frame.extensionWorld()`), or it
  passes for the wrong reason.
- Inside the cross-site preview frame, send input as page-world events (see `pressInFrame` in `tests/e2e/preview.test.mjs`); real
  right-clicks open a context menu that blocks headless input.
