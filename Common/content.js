// content.js

// --- Global Event Listeners for Triggering Previews ---

document.addEventListener('mousedown', e => {
  // Check if the current site is disabled
  if (state.isCurrentSiteDisabled) {
    return;
  }
  if (e.button && e.button > 1) return; // Only allow preview with long press of left click

  const link = e.target.closest('a');
  // Check if the target is a valid link to preview.
  if (link && link.href && !link.href.startsWith('javascript:')) {
    if (state.isPreviewing && (!state.isDragging)) {
      const url = link.href;
      log(`User clicked a link on Parent Page while Preview is Open: ${url}`);
      e.preventDefault();
      e.stopPropagation();
      chrome.runtime.sendMessage({ action: message.updatePreviewUrl, url: url })
      return;
    }
    // If the modifier key is pressed, create the preview immediately.
    if (e[settings.modifier]) {
      e.preventDefault();
      e.stopPropagation();
      createPreview(link.href);
      return;
    }
    // Otherwise, start a timer for a long press.
    state.longClickTimer = setTimeout(() => {
      createPreview(link.href);
    }, settings.duration);
  }
}, true);

// Listen for 'mouseup' to cancel the long-press timer if the mouse is released early.
document.addEventListener('mouseup', (e) => {
  clearTimeout(state.longClickTimer);
  if (state.isPreviewing && (!state.isDragging)) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

// Listen for 'click' with the modifier key to prevent the default navigation action.
document.addEventListener('click', e => {
  const link = e.target.closest('a');
  if (link) {
    if ((e[settings.modifier]) ||
      (state.isPreviewing)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
}, true);


// --- Preconnect Optimization ---

let hoverTimer = null;
let lastHoveredUrl = null;

// When a user hovers over a link, send a message to the background script to preconnect.
// This can speed up the eventual loading of the page in the preview.
document.addEventListener('mouseover', e => {
  // Check if the current site is disabled
  if (state.isCurrentSiteDisabled) {
    return;
  }
  const link = e.target.closest('a');
  if (link && link.href && link.href !== lastHoveredUrl) {
    lastHoveredUrl = link.href;
    clearTimeout(hoverTimer); // Debounce the event.
    // Wait a moment before preconnecting to avoid doing it for every link the mouse passes over.
    hoverTimer = setTimeout(() => {
      chrome.runtime.sendMessage({ action: message.preconnect, url: link.href });
    }, 100);
  }
});

// When the mouse leaves a link, clear the preconnect timer.
document.addEventListener('mouseout', e => {
  const link = e.target.closest('a');
  if (link) {
    clearTimeout(hoverTimer);
    lastHoveredUrl = null;
  }
});