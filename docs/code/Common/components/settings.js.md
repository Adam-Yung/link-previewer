# Common/components/settings.js

Loads the user's settings over the defaults in `global.js` and keeps them live: a change saved in the settings popup reaches open pages
through `storage.onChanged` without a reload.

- Only keys that exist in the defaults are copied, so stale keys from older versions are ignored.
- The site switch is by exact hostname (`www.example.com` and `example.com` are different entries).
