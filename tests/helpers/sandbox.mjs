// Loads the extension's plain scripts into one node:vm context, the way the browser loads content scripts into one shared scope, with a
// recording fake of the extension API. Top-level const/let/class are not properties of the global object, so callers name the
// bindings they want back and the loader appends an expression that returns them.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

function event() {
  const listeners = [];
  return {
    listeners,
    addListener: (fn) => listeners.push(fn),
    removeListener: (fn) => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    },
    fire: (...args) => listeners.map((fn) => fn(...args)),
  };
}

function storageArea(initial = {}) {
  const data = { ...initial };
  return {
    data,
    get: async (keys) => {
      if (keys && typeof keys === 'object' && !Array.isArray(keys)) return { ...keys, ...data };
      if (typeof keys === 'string') return keys in data ? { [keys]: data[keys] } : {};
      return { ...data };
    },
    set: async (items) => { Object.assign(data, items); },
  };
}

export function fakeExtensionApi() {
  const calls = { updateSessionRules: [], tabsSendMessage: [], runtimeSendMessage: [], fetch: [] };
  const api = {
    calls,
    runtime: {
      id: 'test-extension-id',
      onMessage: event(),
      onInstalled: event(),
      getURL: (path) => `chrome-extension://test-extension-id/${path}`,
      sendMessage: async (msg) => { calls.runtimeSendMessage.push(msg); return { ready: true }; },
    },
    storage: { local: storageArea(), session: storageArea(), onChanged: event() },
    declarativeNetRequest: {
      updateSessionRules: async (change) => { calls.updateSessionRules.push(structuredClone(change)); },
    },
    tabs: {
      onUpdated: event(),
      onRemoved: event(),
      sendMessage: (tabId, msg) => { calls.tabsSendMessage.push({ tabId, msg }); },
    },
    webRequest: {
      onBeforeSendHeaders: event(),
      onHeadersReceived: event(),
    },
  };
  return api;
}

// files: repo-relative paths, loaded in order. names: top-level bindings to return. globals: extra globals (document, window, ...).
export function loadScripts(files, names, globals = {}) {
  const api = fakeExtensionApi();
  const context = vm.createContext({
    chrome: api,
    browser: api,
    console,
    URL,
    setTimeout,
    clearTimeout,
    structuredClone,
    fetch: async (url, init) => { api.calls.fetch.push({ url, init }); return { ok: true }; },
    AbortController,
    ...globals,
  });
  const source = files.map((f) => readFileSync(join(ROOT, f), 'utf8')).join('\n;\n');
  const exportsExpr = `\n;({ ${names.join(', ')} })`;
  const bindings = vm.runInContext(source + exportsExpr, context, { filename: files.join('+') });
  return { ...bindings, api, context };
}

// Lets queued promise callbacks (the background's serialized rule updates) run.
export const flush = () => new Promise((resolve) => setImmediate(resolve));
