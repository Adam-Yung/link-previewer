// content.js: the host page's triggers for opening a preview (long press, modifier + click) and for steering an open one.

// A press that travels further than this is a drag or a text selection, not a long press.
const LONG_PRESS_SLOP_PX = 8;
const UNPREVIEWABLE_SCHEME = /^(javascript|data|blob|file|chrome-extension|moz-extension):/i;

let pressStart = null;

function previewableLinkAt(e) {
  const link = e.target.closest?.('a');
  if (!link || !link.href || UNPREVIEWABLE_SCHEME.test(link.href)) return null;
  return link;
}

function cancelLongPress() {
  clearTimeout(state.longClickTimer);
  pressStart = null;
}

function swallow(e) {
  e.preventDefault();
  e.stopPropagation();
}

function onMouseDown(e) {
  if (state.isCurrentSiteDisabled || e.button !== 0) return;
  const link = previewableLinkAt(e);
  if (!link) return;
  if (state.isPreviewing && !state.isDragging) {
    log(`User clicked a link on Parent Page while Preview is Open: ${link.href}`);
    swallow(e);
    chrome.runtime.sendMessage({ action: message.updatePreviewUrl, url: link.href }).catch(() => {});
    return;
  }
  if (e[settings.modifier]) {
    swallow(e);
    createPreview(link.href);
    return;
  }
  pressStart = { x: e.clientX, y: e.clientY };
  state.longClickTimer = setTimeout(() => {
    pressStart = null;
    createPreview(link.href);
  }, settings.duration);
}

function onMouseMove(e) {
  if (!pressStart) return;
  if (Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) > LONG_PRESS_SLOP_PX) cancelLongPress();
}

function restorePreviewPointerEvents() {
  const root = document.getElementById('link-preview-host')?.shadowRoot;
  if (!root) return;
  for (const id of ['link-preview-container', 'link-preview-iframe', 'link-preview-image']) {
    const el = root.getElementById(id);
    if (el) el.style.pointerEvents = 'auto';
  }
}

function onMouseUp(e) {
  cancelLongPress();
  if (!state.isPreviewing || state.isDragging) return;
  restorePreviewPointerEvents();
  swallow(e);
}

// A modifier click or any click while a preview is open must not also follow the link. On a disabled site nothing is intercepted.
function onClick(e) {
  if (state.isCurrentSiteDisabled || !e.target.closest?.('a')) return;
  if (e[settings.modifier] || state.isPreviewing) swallow(e);
}

document.addEventListener('mousedown', onMouseDown, true);
document.addEventListener('mousemove', onMouseMove, true);
document.addEventListener('dragstart', cancelLongPress, true);
document.addEventListener('mouseup', onMouseUp, true);
document.addEventListener('click', onClick, true);


// --- Preconnect Optimization ---

let hoverTimer = null;
let lastHoveredUrl = null;

// When a user hovers over a link, send a message to the background script to preconnect.
// This can speed up the eventual loading of the page in the preview.
document.addEventListener('mouseover', e => {
  if (state.isCurrentSiteDisabled) return;
  const link = e.target.closest('a');
  if (!link || !link.href || link.href === lastHoveredUrl || !/^https?:/.test(link.href)) return;
  const href = link.href;
  lastHoveredUrl = href;
  clearTimeout(hoverTimer); // Debounce the event.
  hoverTimer = setTimeout(() => {
    chrome.runtime.sendMessage({ action: message.preconnect, url: href }).catch(() => {});
  }, 100);
});

document.addEventListener('mouseout', e => {
  if (e.target.closest('a')) {
    clearTimeout(hoverTimer);
    lastHoveredUrl = null;
  }
});
