# Common/components/focus.js

Scroll ownership: while the mouse is over the preview (or the iframe has focus) the host page's scrolling is locked so the wheel scrolls
the preview only; leaving the window unlocks it, except in center stage where the page stays locked. Debounced so crossing the border
does not flicker. Loaded in every frame by the manifest, but only used in the top frame.
