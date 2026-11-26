# Release 2.4.0

## Declare "no data collection" in the Firefox manifest (2026-11-26)
- **What:** `browser_specific_settings.gecko.data_collection_permissions = { required: ["none"] }`.
- **Why:** AMO has required the key for new extensions since 2025-11-03 and planned to extend it to every extension in the first half of
  2026; a version without it can be refused for signing. The extension sends nothing off the device (no fetch, XHR or beacon in the
  shipped code), so "none" is accurate. Once a version carries the key, every later version must.
- **Risk:** Firefox releases older than 140 do not know the key: no consent UI, possibly an unknown-key warning on install (not
  verified). Loading and the smoke test verified on Firefox 159.
- **Reverse:** remove the key, only if AMO stops asking for it.
