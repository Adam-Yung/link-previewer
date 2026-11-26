// content_iframe.js: runs in every frame, acts only inside the extension's preview iframe.

function isPreviewFrame() {
  return window.self !== window.top && window.name === 'link-previewer-frame';
}

// Only a plain primary click keeps browsing inside the preview. Right, middle and modifier clicks (open in new tab, context menu,
// download) belong to the browser.
function isPlainPrimaryPress(e) {
  return e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey;
}

function previewableLink(e) {
  const link = e.target.closest?.('a');
  if (!link || !link.href || link.hasAttribute('download')) return null;
  return /^https?:/i.test(link.href) ? link : null;
}

function onPreviewMouseDown(e) {
  if (!isPlainPrimaryPress(e)) return;
  const link = previewableLink(e);
  if (!link) return;
  log(`[IFRAME] User clicked a link inside of the iFrame: ${link.href}`);
  e.preventDefault();
  e.stopPropagation();
  chrome.runtime.sendMessage({ action: message.updatePreviewUrl, url: link.href }).catch(() => {});
}

function initPreviewFrame() {
  let closeKey = 'Escape';
  chrome.storage.local.get('closeKey').then(result => {
    closeKey = result.closeKey || 'Escape';
  }).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && Object.hasOwn(changes, 'closeKey')) closeKey = changes.closeKey.newValue;
  });

  document.addEventListener('keydown', (e) => {
    if (isCloseKey(e, closeKey)) chrome.runtime.sendMessage({ action: message.closePreviewFromIframe }).catch(() => {});
  });
  document.addEventListener('mousedown', onPreviewMouseDown, true);
  window.addEventListener('focus', () => {
    chrome.runtime.sendMessage({ action: message.iFrameHasFocus }).catch(() => {});
  });
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === message.focusPreview) window.focus();
  });
}

if (isPreviewFrame()) initPreviewFrame();
