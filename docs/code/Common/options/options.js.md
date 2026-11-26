# Common/options/options.js

The toolbar popup's settings form.

- Defaults here must match `settings` in `Common/components/global.js`.
- Saving validates dimensions (number plus a CSS unit) and the hold time (100–10,000 ms) before writing anything.
- The site switch writes immediately; the rest waits for Save. Reset writes the defaults at once and keeps the disabled-site list.
- The close key field records `e.key`, with the space bar stored as `Space` (matched by `isCloseKey()` in `shared.js`).
