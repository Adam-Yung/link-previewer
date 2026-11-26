// content.js: the host page's triggers for opening a preview (long press, modifier + click) and for steering an open one.

// A press that travels further than this is a drag or a text selection, not a long press.
const LONG_PRESS_SLOP_PX = 8;
// The preview starts loading, hidden, this long before the hold ends, but never before SPECULATE_MIN_MS into the press: ordinary
// clicks can last 150 ms or more on a trackpad, and a hidden load during a click still costs a request to the linked page (a one-time
// link would be spent). Skipped when the head start would be under 100 ms.
const SPECULATE_LEAD_MS = 250;
const SPECULATE_MIN_MS = 300;
const UNPREVIEWABLE_SCHEME = /^(javascript|data|blob|file|chrome-extension|moz-extension):/i;

let pressStart = null;

function previewableLinkAt(e) {
  const link = e.target.closest?.('a');
  // SVG links have an SVGAnimatedString href, not a URL string.
  if (!link || typeof link.href !== 'string' || !link.href || UNPREVIEWABLE_SCHEME.test(link.href)) return null;
  return link;
}

function cancelLongPress() {
  clearTimeout(state.longClickTimer);
  clearTimeout(state.speculateTimer);
  pressStart = null;
  discardSpeculativePreview();
}

// Opens the connection (DNS, TCP, TLS) from the page itself, so the preview iframe, which shares the page's network partition, can
// reuse it. No HTTP request is sent.
const preconnectedOrigins = new Set();
function preconnect(url) {
  const { origin, protocol } = new URL(url);
  if (!/^https?:$/.test(protocol) || preconnectedOrigins.has(origin)) return;
  preconnectedOrigins.add(origin);
  const hint = document.createElement('link');
  hint.rel = 'preconnect';
  hint.href = origin;
  document.head.appendChild(hint);
  setTimeout(() => {
    hint.remove();
    preconnectedOrigins.delete(origin);
  }, 10000);
}

// When to start loading during a hold of `duration` ms, or null for no head start.
function speculationDelay(duration) {
  const at = Math.max(SPECULATE_MIN_MS, duration - SPECULATE_LEAD_MS);
  return duration - at >= 100 ? at : null;
}

function startLongPress(e, href) {
  pressStart = { x: e.clientX, y: e.clientY };
  preconnect(href);
  const speculateAt = speculationDelay(settings.duration);
  if (speculateAt !== null) state.speculateTimer = setTimeout(() => createPreview(href, { hidden: true }), speculateAt);
  state.longClickTimer = setTimeout(() => {
    pressStart = null;
    if (state.isSpeculative) revealPreview();
    else createPreview(href);
  }, settings.duration);
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
  startLongPress(e, link.href);
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
