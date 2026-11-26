# Common/components/svg.js

Inline SVG strings for the preview's buttons and popups. Inline so the window needs no extra web-accessible resources and renders
before any file loads. Constants only: they are inserted with `innerHTML`, so they must never be built from page or URL text.
