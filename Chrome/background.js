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

let ruleUpdateQueue = Promise.resolve();

function serializedRuleUpdate(fn) {
  ruleUpdateQueue = ruleUpdateQueue.then(fn).catch(() => {});
}

/**
 * Enables the header modification rules scoped to currently previewing tabs.
 * Rebuilds rules with the current set of tab IDs to ensure only preview tabs
 * have their security headers stripped.
 */
function enableRule() {
  serializedRuleUpdate(async () => {
    const tabIds = [...previewingTabIds];
    if (tabIds.length === 0) return;

    const scopedResponseRule = {
      ...responseHeaderRule,
      condition: { ...responseHeaderRule.condition, tabIds }
    };
    const scopedRequestRule = {
      ...requestHeaderRule,
      condition: { ...requestHeaderRule.condition, tabIds }
    };

    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [RULE_ID, RULE_ID_REQUEST],
      addRules: [scopedResponseRule, scopedRequestRule]
    });
    log('[BACKGROUND] Header modification rules ENABLED for tabs: ' + tabIds.join(', '));
  });
}


/**
 * Disables the header modification rules. This function is idempotent.
 */
function disableRule() {
  serializedRuleUpdate(async () => {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [RULE_ID, RULE_ID_REQUEST]
    });
    log('[BACKGROUND] Header modification rules DISABLED.');
  });
}


// --- Event Listeners ---

// On installation, clear any existing session rules.
chrome.runtime.onInstalled.addListener(() => {
  disableRule();
});

// Listens for messages from content scripts.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!sender.tab) return;
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
        if (previewingTabIds.size === 0) {
          disableRule();
        } else {
          enableRule();
        }
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

// Clean up when a tab is closed.
chrome.tabs.onRemoved.addListener((tabId) => {
  if (previewingTabIds.has(tabId)) {
    previewingTabIds.delete(tabId);
    log(`[BACKGROUND] Preview tab ${tabId} closed, removed from set.`);
    if (previewingTabIds.size === 0) {
      disableRule();
    } else {
      enableRule();
    }
  }
});