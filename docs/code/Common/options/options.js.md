# Common/options/options.js

The toolbar popup's settings form.

- Defaults here must match `settings` in `Common/components/global.js`.
- Saving validates dimensions (number plus a CSS unit) and the hold time (100–10,000 ms) before writing anything.
- The site switch writes immediately; the rest waits for Save. Reset writes the defaults at once and re-enables the current site; other disabled sites stay.
- Theme: the stored choice is `auto` until the user flips the switch; the switch shows the resolved theme. Saving writes the choice,
  so an untouched switch keeps `auto`. Reset goes back to `auto`. Needs `../components/shared.js` (loaded first in `options.html`).
- The close key field records `e.key`, with the space bar stored as `Space` (matched by `isCloseKey()` in `shared.js`).
