# Common/components/sizing.js

Drag, resize and keeping the window on screen.

- Centered windows use percentage and class-based positioning; the first drag or resize converts them to pixels (`convertToPixels`),
  which also leaves center stage.
- While dragging or resizing, the iframe stops taking pointer events, or the mouse would vanish into the framed page mid-drag.
- The pocket window's geometry is saved after each drag or resize and reused for the next preview.
- After a window resize (debounced) the window is pulled back inside the viewport.
