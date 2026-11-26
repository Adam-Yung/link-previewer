# Next work

In order. Delete an item when it lands; its outcome goes in `docs/status.md`.

1. Firefox on real sites that refuse framing, and whether `requestHeadersListener` still matters (the local smoke test passes with it).
2. Firefox: a host page that changes its URL with `pushState` while a preview is open still ends the preview (Chrome tells them apart
   by `documentId`, which MV2 senders lack).
