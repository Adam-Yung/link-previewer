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

function storageArea(data = {}) {
  const read = (keys) => {
    if (keys && typeof keys === 'object' && !Array.isArray(keys)) return structuredClone({ ...keys, ...data });
    if (typeof keys === 'string') return keys in data ? structuredClone({ [keys]: data[keys] }) : {};
    return structuredClone(data);
  };
  return {
    data,
    // Both forms the extension uses: promise, and callback (answered on a later task, as the browser does).
    get: (keys, callback) => {
      if (callback) return void setTimeout(() => callback(read(keys)), 0);
      return Promise.resolve(read(keys));
    },
    set: async (items) => { Object.assign(data, structuredClone(items)); },
  };
}

// Session rules as the browser keeps them: they survive a service-worker restart, and an update that adds an id already present
// fails as a whole.
function sessionRules(rules = new Map()) {
  return {
    rules,
    updateSessionRules: async ({ removeRuleIds = [], addRules = [] }) => {
      const next = new Map(rules);
      for (const id of removeRuleIds) next.delete(id);
      for (const rule of addRules) {
        if (next.has(rule.id)) throw new Error(`Rule with id ${rule.id} already exists`);
        next.set(rule.id, structuredClone(rule));
      }
      rules.clear();
      for (const [id, rule] of next) rules.set(id, rule);
    },
    getSessionRules: async () => [...rules.values()].map((r) => structuredClone(r)),
  };
}

// persisted: what outlives a service-worker restart ({ session, rules }); pass the same object to a second load to restart.
export function fakeExtensionApi(persisted = {}) {
  persisted.session ??= {};
  persisted.rules ??= new Map();
  const dnr = sessionRules(persisted.rules);
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
    storage: { local: storageArea(), session: storageArea(persisted.session), onChanged: event() },
    declarativeNetRequest: {
      updateSessionRules: async (change) => {
        calls.updateSessionRules.push(structuredClone(change));
        return dnr.updateSessionRules(change);
      },
      getSessionRules: dnr.getSessionRules,
    },
    tabs: {
      onUpdated: event(),
      onRemoved: event(),
      // A test sets tabs.reply to answer (return a value, or throw for "no such document").
      reply: () => undefined,
      sendMessage: async (tabId, msg, options) => {
        calls.tabsSendMessage.push({ tabId, msg, options });
        return api.tabs.reply(tabId, msg, options);
      },
    },
    webRequest: {
      onBeforeSendHeaders: event(),
      onHeadersReceived: event(),
    },
  };
  return api;
}

// files: repo-relative paths, loaded in order. names: top-level bindings to return. globals: extra globals (document, window, ...).
export function loadScripts(files, names, globals = {}, persisted = {}) {
  const api = fakeExtensionApi(persisted);
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

// Lets queued work (storage callbacks, the background's serialized rule updates) run.
export const flush = () => new Promise((resolve) => setTimeout(resolve, 5));
