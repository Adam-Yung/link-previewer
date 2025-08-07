// content_iframe.js

// Check if this script is running inside an iframe
if (window.self !== window.top) {
  /**
   * Handling CloseKey Logic
   */
  let closeKey = "Escape";

  chrome.storage.local.get('closeKey').then(result => {
    closeKey = result.closeKey || "Escape";
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.hasOwnProperty("closeKey")) {
        closeKey = changes["closeKey"].newValue;
      }
    }
  });

  document.addEventListener('keydown', (e) => {
      if (e.key === closeKey) {
        chrome.runtime.sendMessage({ action: 'closePreviewFromIframe'})
    }
  });

  
  /**
   * Handling User Clicking other links within the IFrame
   */
  document.addEventListener('mousedown', e => {
    const link = e.target.closest('a');
    // Check if the target is a valid link to preview.
    if (link && link.href && !link.href.startsWith('javascript:')) {
      const url = link.href;
      log(`[IFRAME] User clicked a link inside of the iFrame: ${url}`);
      e.preventDefault();
      e.stopPropagation();
      chrome.runtime.sendMessage({ action: 'updatePreviewUrl', url: url })
    }
  }, true);


  /**
   * Handling IFrame receiving Focus
   */
  window.addEventListener('focus', () => {
    chrome.runtime.sendMessage({ action: 'iFrameHasFocus'})
  })

}