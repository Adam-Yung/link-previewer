# Next work

In order. Delete an item when it lands; its outcome goes in `docs/status.md`.

1. Run the Firefox build in a real Firefox: previews of frame-forbidding sites, and whether `requestHeadersListener` still matters.
2. Host pages that change their URL with `pushState` while a preview is open lose the preview's header rules (`tabs.onUpdated`); end
   previews only on real navigations.
