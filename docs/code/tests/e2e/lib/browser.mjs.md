# tests/e2e/lib/browser.mjs

Starts Chrome headless in a fresh profile, deleted on close: Chrome for Testing from the Playwright cache, or any Chrome binary in
`LP_CHROME`. Never the user's own Chrome profile.

- The extension is installed with `Extensions.loadUnpacked` (needs `--enable-unsafe-extension-debugging` and the pipe), the same
  unpacked installer as Load unpacked on `chrome://extensions`. Branded Google Chrome ignores `--load-extension` since 137, so the
  flag would only work in Chrome for Testing. Verified on Google Chrome 156 on prisma-vm: 23/23 (2026-11-26).

- `*.test` hosts resolve to 127.0.0.1 and certificate errors are ignored, so the local fixtures act like real HTTPS sites on different
  sites (`host.test`, `target.test`). The extension refuses to preview plain HTTP, so HTTPS is required.
- The extension's service worker is found by manifest name: Chrome for Testing runs built-in component extensions with service workers
  of their own.
- The preview iframe is cross-site, so it is an out-of-process frame with its own target; `frameSession()` finds it by URL. Tests close
  their tabs (`closePages()`) so a lookup can never pick a frame left from an earlier test.
- `extensionWorld()` waits until the extension's content scripts have an isolated world in a frame; before that, input to the frame is
  not seen by the extension and a "nothing happened" assertion would pass for the wrong reason.
- `eval()` has a timeout: evaluating in a frame that navigates away never answers.
