# Next work

In order. Delete an item when it lands; its outcome goes in `docs/status.md`.

1. Run the Firefox build in a real Firefox: previews of frame-forbidding sites, and whether `requestHeadersListener` still matters.
2. Firefox: a host page that changes its URL with `pushState` while a preview is open still ends the preview (Chrome tells them apart
   by `documentId`, which MV2 senders lack).
