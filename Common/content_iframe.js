// content_iframe.js

// Check if this script is running inside an iframe
if (window.self !== window.top) {
  // Listen for 'mousedown' to initiate either a long-press or a modifier-key preview.
  // Using the capture phase (true) to catch the event early.
  document.addEventListener('mousedown', e => {
    const link = e.target.closest('a');
    // Check if the target is a valid link to preview.
    if (link && link.href && !link.href.startsWith('javascript:')) {
      const url = link.href;
      console.log(`User clicked a link inside of the iFrame: ${url}`);
      chrome.runtime.sendMessage({ action: 'updatePreviewUrl', url: url })
    }
  }, true);
}