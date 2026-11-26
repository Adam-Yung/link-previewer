# Status

- Version 2.4.0 is tagged and built (`CHANGELOG`); store submission is pending. 2.3.0 is what the Chrome Web Store and AMO serve.
- The framework is adopted: brief, gate (`scripts/verify.sh`: unit tests, e2e in Chrome for Testing, eslint, structure ratchet, doc
  gates), a code mirror for every source file.
- Header rewriting is limited to the preview's own requests in the previewing tab, holds back cookie rewriting until a preview is
  shown, and survives service-worker restarts without leaking rules (`docs/code/Chrome/background.js.md`).
- A long press loads the preview during the hold; hovering sends no requests (`docs/features/performance.md`).
- The preview and settings follow the system's light or dark appearance unless the user picks one.
- Firefox 159 runs the build correctly against the local fixtures (`npm run e2e:firefox`, 8/8 on prisma-vm). Not yet tried on real
  sites (`docs/todo.md`).
