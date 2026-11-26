// background.js (Chrome, MV3 service worker). `components/shared.js` is prepended at build time.

// Tabs with an open preview, mapped to the hostname of the page that hosts the preview. Kept in session storage because the service
// worker can be stopped while a preview is open.
const previewingTabs = new Map();

const FRAME_RESPONSE_HEADERS = [
  { header: 'x-frame-options', operation: 'remove' },
  {
    header: 'content-security-policy',
    operation: 'set',
    value: 'sandbox allow-scripts allow-same-origin allow-forms allow-modals allow-presentation allow-popups;'
  },
  { header: 'x-content-type-options', operation: 'remove' },
  { header: 'cross-origin-opener-policy', operation: 'remove' },
  { header: 'cross-origin-embedder-policy', operation: 'remove' },
  { header: 'cross-origin-resource-policy', operation: 'remove' },
  // Cookies set inside a cross-site frame are rejected unless SameSite=None, which breaks consent and login flows in the preview.
  { header: 'set-cookie', operation: 'append', value: '; SameSite=None; Secure' }
];

// Fetch metadata that says "top-level navigation", so servers that refuse to be framed serve the page.
const FRAME_REQUEST_HEADERS = [
  { header: 'sec-fetch-dest', operation: 'set', value: 'document' },
  { header: 'sec-fetch-mode', operation: 'set', value: 'navigate' },
  { header: 'sec-fetch-site', operation: 'set', value: 'none' }
];

const SUBRESOURCE_TYPES = ['xmlhttprequest', 'script', 'stylesheet', 'image', 'font'];

// '' when there is no domain to exclude by: a file: page, or an IPv6 literal, which DNR rejects as a domain (and one rejected rule
// fails the whole update, for every tab).
function hostnameOf(url) {
  try {
    const { hostname } = new URL(url);
    return hostname.startsWith('[') ? '' : hostname;
  } catch {
    return '';
  }
}

/**
 * The rules for one previewing tab. The frame rules cannot tell the preview frame from the host page's other frames (DNR has no frame
 * condition), so they cover every sub_frame in the tab while the preview is open. Subresource rewriting is what the previewed page's
 * own requests need; it excludes requests the host page itself starts, and is left out entirely when the host has no domain to exclude.
 */
function rulesForTab(tabId, host) {
  const rules = [
    { action: { type: 'modifyHeaders', responseHeaders: FRAME_RESPONSE_HEADERS }, condition: { resourceTypes: ['sub_frame'], tabIds: [tabId] } },
    { action: { type: 'modifyHeaders', requestHeaders: FRAME_REQUEST_HEADERS }, condition: { resourceTypes: ['sub_frame'], tabIds: [tabId] } }
  ];
  if (host) {
    rules.push({
      action: { type: 'modifyHeaders', responseHeaders: FRAME_RESPONSE_HEADERS },
      condition: { resourceTypes: SUBRESOURCE_TYPES, tabIds: [tabId], excludedInitiatorDomains: [host] }
    });
  }
  return rules;
}

function buildRules() {
  const rules = [...previewingTabs].flatMap(([tabId, host]) => rulesForTab(tabId, host));
  return rules.map((rule, i) => ({ id: i + 1, priority: 1, ...rule }));
}

let ruleUpdateQueue = Promise.resolve();

// Rule updates are asynchronous; chaining them keeps a slow update from landing after a newer one. The extension owns every session
// rule, so each rebuild removes whatever is installed: session rules outlive a service-worker restart, in-memory bookkeeping does not.
function syncRules() {
  ruleUpdateQueue = ruleUpdateQueue.then(async () => {
    const addRules = buildRules();
    const removeRuleIds = (await chrome.declarativeNetRequest.getSessionRules()).map((r) => r.id);
    const change = addRules.length ? { removeRuleIds, addRules } : { removeRuleIds };
    await chrome.declarativeNetRequest.updateSessionRules(change);
    log(`[BACKGROUND] Header rules now cover tabs: ${[...previewingTabs.keys()].join(', ') || 'none'}`);
  }).catch((error) => log(`[BACKGROUND] Rule update failed: ${error}`, LOGGING.ERROR));
}

function persistPreviewingTabs() {
  chrome.storage.session.set({ previewingTabs: [...previewingTabs] });
}

function startPreview(tabId, hostUrl) {
  previewingTabs.set(tabId, hostnameOf(hostUrl));
  persistPreviewingTabs();
  syncRules();
}

function stopPreview(tabId) {
  if (!previewingTabs.delete(tabId)) return;
  persistPreviewingTabs();
  syncRules();
}

// Messages the background only forwards to the tab's top frame (between the preview iframe and the page hosting it).
const RELAYED = new Set([message.iFrameHasFocus, message.focusPreview, message.updatePreviewUrl, message.closePreviewFromIframe]);

function relayToTab(tabId, request) {
  const relayed = { action: request.action };
  if (request.url) relayed.url = request.url;
  chrome.tabs.sendMessage(tabId, relayed);
}

// The worker may have been woken by the very event that ends a preview, so every handler that reads previewingTabs waits for the
// restore first; otherwise the event finds an empty map and the restore puts the tab back afterwards.
const restored = new Promise((resolve) => {
  chrome.storage.session.get('previewingTabs', (result) => {
    for (const [tabId, host] of result?.previewingTabs || []) previewingTabs.set(tabId, host);
    resolve();
  });
});
const afterRestore = (fn) => (...args) => { restored.then(() => fn(...args)); };

chrome.runtime.onInstalled.addListener(afterRestore(() => {
  previewingTabs.clear();
  persistPreviewingTabs();
  syncRules();
}));

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!sender.tab) return;
  const tabId = sender.tab.id;
  if (request.action === message.prepareToPreview) {
    afterRestore(() => {
      startPreview(tabId, sender.url || sender.tab.url);
      sendResponse({ ready: true });
    })();
    return true; // answered asynchronously
  }
  if (request.action === message.clearPreview) {
    afterRestore(stopPreview)(tabId);
    return;
  }
  if (RELAYED.has(request.action)) relayToTab(tabId, request);
});

// A preview never survives its tab navigating or closing.
chrome.tabs.onUpdated.addListener(afterRestore((tabId, changeInfo) => {
  if (changeInfo.url) stopPreview(tabId);
}));
chrome.tabs.onRemoved.addListener(afterRestore((tabId) => stopPreview(tabId)));
