// background.js

const RULE_ID = 1;
const RULE_ID_REQUEST = 2;
// Use a Set to store the IDs of all tabs with an active preview.
const previewingTabIds = new Set();

// Rule to modify response headers (remove frame restrictions)
const responseHeaderRule = {
  id: RULE_ID,
  priority: 1,
  action: {
    type: 'modifyHeaders',
    responseHeaders: [
      { header: 'x-frame-options', operation: 'remove' },
      {
        header: 'content-security-policy',
        operation: 'set',
        value: "sandbox allow-scripts allow-same-origin allow-forms allow-modals allow-presentation allow-popups;"
      },
      { header: 'x-content-type-options', operation: 'remove' },
      { header: 'cross-origin-opener-policy', operation: 'remove' },
      { header: 'cross-origin-embedder-policy', operation: 'remove' },
      { header: 'cross-origin-resource-policy', operation: 'remove' },
      {
        "header": "Set-Cookie",
        "operation": "append",
        "value": "; SameSite=None; Secure"
      }
    ]
  },
  condition: {
    resourceTypes: ['sub_frame', 'xmlhttprequest', 'script', 'stylesheet', 'image', 'font']
  }
};

// Rule to modify request headers (spoof fetch metadata so sites don't detect framing)
const requestHeaderRule = {
  id: RULE_ID_REQUEST,
  priority: 1,
  action: {
    type: 'modifyHeaders',
    requestHeaders: [
      { header: 'sec-fetch-dest', operation: 'set', value: 'document' },
      { header: 'sec-fetch-mode', operation: 'set', value: 'navigate' },
      { header: 'sec-fetch-site', operation: 'set', value: 'none' }
    ]
  },
  condition: {
    resourceTypes: ['sub_frame']
  }
};

// --- Helper Functions to Manage the DNR Rule ---

/**
 * Enables the header modification rules.
 * Checks if the rules are already active to avoid redundant API calls.
 */
async function enableRule() {
  const existingRules = await chrome.declarativeNetRequest.getSessionRules();

  const hasResponseRule = existingRules.some(rule => rule.id === RULE_ID);
  const hasRequestRule = existingRules.some(rule => rule.id === RULE_ID_REQUEST);

  if (hasResponseRule && hasRequestRule) {
    return;
  }

  const rulesToAdd = [];
  if (!hasResponseRule) rulesToAdd.push(responseHeaderRule);
  if (!hasRequestRule) rulesToAdd.push(requestHeaderRule);

  await chrome.declarativeNetRequest.updateSessionRules({
    addRules: rulesToAdd
  });
  log('[BACKGROUND] Header modification rules ENABLED.');
}


/**
 * Disables the header modification rules. This function is idempotent.
 */
async function disableRule() {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [RULE_ID, RULE_ID_REQUEST]
  });
  log('[BACKGROUND] Header modification rules DISABLED.');
}


// --- Event Listeners ---

// On installation, clear any existing session rules.
chrome.runtime.onInstalled.addListener(() => {
  disableRule();
});

// Listens for messages from content scripts.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const tabId = sender.tab.id;
  switch (request.action) {
    case message.prepareToPreview:
      log(`[BACKGROUND] Activating preview for tab: ${tabId}`);
      previewingTabIds.add(tabId);
      // Enable the rule immediately since this tab is now actively previewing.
      enableRule();
      sendResponse({ ready: true });
      break;
    case message.clearPreview:
      if (previewingTabIds.has(tabId)) {
        log(`[BACKGROUND] Deactivating preview for tab: ${tabId}`);
        previewingTabIds.delete(tabId);
        // After clearing a preview, check if the currently active tab is still
        // a preview tab. If not, disable the rule.
        chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
          if (!activeTabs[0] || !previewingTabIds.has(activeTabs[0].id)) {
            disableRule();
          }
        });
      }
      break;
    case message.preconnect:
      // Preconnect to warm up the connection (no changes needed here).
      fetch(request.url, { method: 'HEAD', mode: 'no-cors' }).catch(() => {
        // This is an optimization; ignore errors.
      });
      break;
    case message.iFrameHasFocus:
      chrome.tabs.sendMessage(sender.tab.id, { action: message.iFrameHasFocus });
      break;
    case message.focusPreview:
      chrome.tabs.sendMessage(sender.tab.id, { action: message.focusPreview });
      break;
    case message.updatePreviewUrl:
      chrome.tabs.sendMessage(sender.tab.id, { action: message.updatePreviewUrl, url: request.url });
      break;
    case message.closePreviewFromIframe:
      chrome.tabs.sendMessage(sender.tab.id, { action: message.closePreviewFromIframe });
      break;
  }
});

/**
 * Fired when the active tab in a window changes. This is the core logic
 * for enabling/disabling the rule on tab switches.
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (previewingTabIds.has(activeInfo.tabId)) {
    log(`[BACKGROUND] Switched TO a preview tab (${activeInfo.tabId}).`);
    await enableRule();
  } else {
    log(`[BACKGROUND] Switched AWAY from a preview tab.`);
    await disableRule();
  }
});

// Clean up when a tab is closed.
chrome.tabs.onRemoved.addListener((tabId) => {
  // Check if the closed tab was in our preview set.
  if (previewingTabIds.has(tabId)) {
    previewingTabIds.delete(tabId);
    log(`[BACKGROUND] Preview tab ${tabId} closed, removed from set.`);
    // If this was the very last previewing tab, ensure the rule is disabled.
    if (previewingTabIds.size === 0) {
      log('[BACKGROUND] Last preview tab closed. Disabling rule.');
      disableRule();
    }
  }
});