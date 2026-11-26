# Build and release

> Verified: 2026-11-26 15:55 · Sources: `tools/build.sh`, `package.json`, `.github/workflows/release.yml`

- `npm run build chrome` or `npm run build firefox` runs `tools/build.sh`; the unpacked extension is in `out/dist`, the zip in `out/`.
- Load it: Chrome `chrome://extensions` → Developer mode → Load unpacked → `out/dist`. Firefox `about:debugging` → This Firefox → Load
  Temporary Add-on → the Firefox zip.
- Release: bump `version` in `package.json` (the build stamps it into the manifest), update `CHANGELOG` and the README badge, push a
  tag named after the version (`2.4.0`, no `v`). `.github/workflows/release.yml` builds both zips and attaches them to a GitHub release.
- Submit `out/link-previewer-chrome-v<version>.zip` to the Chrome Web Store and `out/link-previewer-firefox-v<version>.zip` to AMO.
  AMO also asks for the source: the tagged commit (`git archive <tag>`) with this page's build steps.
- The Firefox manifest declares `data_collection_permissions: none`. Keep it truthful: anything that sends data off the device must
  be declared there (and in the Chrome Web Store privacy form) before release.
