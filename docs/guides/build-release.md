# Build and release

> Verified: 2026-11-26 12:35 · Sources: `tools/build.sh`, `package.json`, `.github/workflows/release.yml`

- `npm run build chrome` or `npm run build firefox` runs `tools/build.sh`; the unpacked extension is in `out/dist`, the zip in `out/`.
- Load it: Chrome `chrome://extensions` → Developer mode → Load unpacked → `out/dist`. Firefox `about:debugging` → This Firefox → Load
  Temporary Add-on → the Firefox zip.
- Release: bump `version` in `package.json` (the build stamps it into the manifest), update `CHANGELOG` and the README badge, push a
  tag. `.github/workflows/release.yml` builds both zips and attaches them to a GitHub release.
