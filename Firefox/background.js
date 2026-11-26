// background.js for Firefox (Manifest V2)

// Tabs with an open preview, mapped to the hostname of the page hosting it.
const previewingTabs = new Map();

function requestHeadersListener(details) {
  if (details.initiator === browser.runtime.id || details.originUrl?.startsWith(browser.runtime.getURL(""))) {
    const targetOrigin = new URL(details.url).origin;

    const originHeader = details.requestHeaders.find(h => h.name.toLowerCase() === 'origin');
    if (originHeader) {
      originHeader.value = targetOrigin;
    } else {
      details.requestHeaders.push({ name: 'Origin', value: targetOrigin });
    }

    // Spoof Sec-Fetch-* headers so the server doesn't detect iframe embedding
    const secFetchDest = details.requestHeaders.find(h => h.name.toLowerCase() === 'sec-fetch-dest');
    if (secFetchDest) {
      secFetchDest.value = 'document';
    }
    const secFetchMode = details.requestHeaders.find(h => h.name.toLowerCase() === 'sec-fetch-mode');
    if (secFetchMode) {
      secFetchMode.value = 'navigate';
    }
    const secFetchSite = details.requestHeaders.find(h => h.name.toLowerCase() === 'sec-fetch-site');
    if (secFetchSite) {
      secFetchSite.value = 'none';
    }

    // Spoof the Referer to match the target
    const refererHeader = details.requestHeaders.find(h => h.name.toLowerCase() === 'referer');
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


const STRIPPED_RESPONSE_HEADERS = new Set([
  'content-security-policy', 'x-frame-options', 'x-content-type-options', 'cross-origin-embedder-policy',
  'cross-origin-opener-policy', 'cross-origin-resource-policy', 'referrer-policy'
]);

function hostnameOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

// Same meaning as Chrome's excludedInitiatorDomains: the domain itself and its subdomains.
function isWithinDomain(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/**
 * Only requests of a previewing tab are rewritten: its frames (webRequest cannot tell the preview frame from the host page's other
 * frames) and XHRs the previewed page starts. XHRs the host page starts are left alone, and so is everything when the host has no
 * domain to tell them apart.
 */
function shouldRewrite(details) {
  if (!previewingTabs.has(details.tabId)) return false;
  if (details.type === 'sub_frame') return true;
  const host = previewingTabs.get(details.tabId);
  return Boolean(host) && !isWithinDomain(hostnameOf(details.originUrl), host);
}

function responseHeadersListener(details) {
  if (!shouldRewrite(details)) return { responseHeaders: details.responseHeaders };

  const newHeaders = details.responseHeaders.filter(header => !STRIPPED_RESPONSE_HEADERS.has(header.name.toLowerCase()));
  // Cookies set inside a cross-site frame are rejected unless SameSite=None, which breaks consent and login flows in the preview.
  for (const header of newHeaders) {
    if (header.name.toLowerCase() === 'set-cookie') header.value += '; SameSite=None; Secure';
  }
  newHeaders.push({
    name: 'Content-Security-Policy',
    value: "sandbox allow-scripts allow-same-origin allow-forms allow-modals allow-presentation allow-popups;"
  });
  log(`[BACKGROUND] Modified response headers for iframe display`);
  return { responseHeaders: newHeaders };
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
      previewingTabs.set(tabId, hostnameOf(sender.url || sender.tab.url));
      registerListeners();
      sendResponse({ ready: true });
      return true;

    case message.clearPreview:
      previewingTabs.delete(tabId);
      if (previewingTabs.size === 0) {
        unregisterListeners();
      }
      break;

    case message.preconnect: {
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
    }
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

// Clean up when a tab is closed.
browser.tabs.onRemoved.addListener((tabId) => {
  if (previewingTabs.has(tabId)) {
    previewingTabs.delete(tabId);
    log(`[BACKGROUND] Preview tab ${tabId} closed, removed from map.`);
    if (previewingTabs.size === 0) {
      unregisterListeners();
    }
  }
});

// A preview never survives its tab navigating away (parity with Chrome).
browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url && previewingTabs.delete(tabId) && previewingTabs.size === 0) unregisterListeners();
});
