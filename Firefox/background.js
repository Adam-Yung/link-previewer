// background.js for Firefox (Manifest V2)

const previewingTabs = new Map();

function requestHeadersListener(details) {
  if (details.initiator === browser.runtime.id || details.originUrl?.startsWith(browser.runtime.getURL(""))) {
    const targetOrigin = new URL(details.url).origin;

    let originHeader = details.requestHeaders.find(h => h.name.toLowerCase() === 'origin');
    if (originHeader) {
      originHeader.value = targetOrigin;
    } else {
      details.requestHeaders.push({ name: 'Origin', value: targetOrigin });
    }

    // Spoof Sec-Fetch-* headers so the server doesn't detect iframe embedding
    let secFetchDest = details.requestHeaders.find(h => h.name.toLowerCase() === 'sec-fetch-dest');
    if (secFetchDest) {
      secFetchDest.value = 'document';
    }
    let secFetchMode = details.requestHeaders.find(h => h.name.toLowerCase() === 'sec-fetch-mode');
    if (secFetchMode) {
      secFetchMode.value = 'navigate';
    }
    let secFetchSite = details.requestHeaders.find(h => h.name.toLowerCase() === 'sec-fetch-site');
    if (secFetchSite) {
      secFetchSite.value = 'none';
    }

    // Spoof the Referer to match the target
    let refererHeader = details.requestHeaders.find(h => h.name.toLowerCase() === 'referer');
    if (refererHeader) {
      refererHeader.value = details.url;
    } else {
      details.requestHeaders.push({ name: 'Referer', value: details.url });
    }

    log(`[BACKGROUND] Spoofed the header request to appear as same origin: ${details.url}`);
    return { requestHeaders: details.requestHeaders };
  }
  return { requestHeaders: details.requestHeaders };
}


// --- Listener to modify response headers ---
function responseHeadersListener(details) {
  const isPreviewFrame = details.type === 'sub_frame' && previewingTabs.size > 0;
  const isPreconnectRequest = details.type === 'xhr' || details.type === 'xmlhttprequest';

  if (isPreviewFrame || isPreconnectRequest) {
    // Filter out the headers we want to remove or modify.
    let newHeaders = details.responseHeaders.filter(header => {
      const headerName = header.name.toLowerCase();
      return !(
        headerName === 'content-security-policy' || // Remove the original CSP
        headerName === 'x-frame-options' ||
        headerName === 'x-content-type-options' ||
        headerName === 'cross-origin-embedder-policy' ||
        headerName === 'cross-origin-opener-policy' ||
        headerName === 'cross-origin-resource-policy' ||
        headerName === 'referrer-policy'
      );
    });

    // Modify Set-Cookie headers to allow cross-site usage
    newHeaders.forEach(header => {
      if (header.name.toLowerCase() === 'set-cookie') {
        header.value += '; SameSite=None; Secure';
      }
    });

    newHeaders.push({
      name: 'Content-Security-Policy',
      value: "sandbox allow-scripts allow-same-origin allow-forms allow-modals allow-presentation allow-popups;"
    });

    log(`[BACKGROUND] Modified response headers for iframe display`);
    return { responseHeaders: newHeaders };
  }
  return { responseHeaders: details.responseHeaders };
}

// --- Dynamic listener registration ---
let listenersRegistered = false;

function registerListeners() {
  if (listenersRegistered) return;
  browser.webRequest.onBeforeSendHeaders.addListener(
    requestHeadersListener,
    { urls: ["<all_urls>"], types: ["sub_frame", "xmlhttprequest"] },
    ["blocking", "requestHeaders"]
  );
  browser.webRequest.onHeadersReceived.addListener(
    responseHeadersListener,
    { urls: ["<all_urls>"], types: ["sub_frame", "xmlhttprequest"] },
    ["blocking", "responseHeaders"]
  );
  listenersRegistered = true;
}

function unregisterListeners() {
  if (!listenersRegistered) return;
  browser.webRequest.onBeforeSendHeaders.removeListener(requestHeadersListener);
  browser.webRequest.onHeadersReceived.removeListener(responseHeadersListener);
  listenersRegistered = false;
}


// --- Message handling from content scripts ---
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  if (!tabId) return;

  switch (request.action) {
    case message.prepareToPreview:
      log(`[BACKGROUND] Preparing for preview: ${request.url}`);
      previewingTabs.set(tabId, request.url);
      registerListeners();
      sendResponse({ ready: true });
      return true;

    case message.clearPreview:
      previewingTabs.delete(tabId);
      if (previewingTabs.size === 0) {
        unregisterListeners();
      }
      break;

    case message.preconnect:
      const controller = new AbortController();
      const signal = controller.signal;
      log(`[BACKGROUND] Preconnecting to: ${request.url}`);
      // Use GET as it's more widely supported than HEAD
      fetch(request.url, { method: 'GET', mode: 'cors', signal }).catch(() => {
        // Errors are expected as we abort the request. This is fine.
      });

      // Abort the request immediately. We don't need the body,
      // just the act of making the request is enough to warm up the connection.
      controller.abort();
      break;
    case message.iFrameHasFocus:
      browser.tabs.sendMessage(sender.tab.id, { action: message.iFrameHasFocus });
      break;
    case message.focusPreview:
      browser.tabs.sendMessage(sender.tab.id, { action: message.focusPreview });
      break;
    case message.updatePreviewUrl:
      browser.tabs.sendMessage(sender.tab.id, { action: message.updatePreviewUrl, url: request.url });
      break;
    case message.closePreviewFromIframe:
      browser.tabs.sendMessage(sender.tab.id, { action: message.closePreviewFromIframe });
      break;
  }
});