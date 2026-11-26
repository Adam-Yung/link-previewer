import assert from 'node:assert';
import { test } from 'node:test';
import { flush, loadScripts } from '../helpers/sandbox.mjs';

function load(persisted = {}) {
  const env = loadScripts(['Common/components/shared.js', 'Chrome/background.js'], ['message'], {}, persisted);
  const send = (action, tabId, url = 'https://host.test/search?q=x') => {
    const reply = {};
    env.api.runtime.onMessage.fire({ action }, { tab: { id: tabId, url }, url, documentId: `doc-${tabId}` }, (r) => Object.assign(reply, r));
    return reply;
  };
  const lastRules = () => env.api.calls.updateSessionRules.at(-1);
  const liveRules = () => env.api.declarativeNetRequest.getSessionRules();
  return { ...env, send, lastRules, liveRules, persisted };
}

const SUBRESOURCE_TYPES = ['xmlhttprequest', 'script', 'stylesheet', 'image', 'font'];

test('prepareToPreview answers ready and installs rules scoped to that tab only', async () => {
  const env = load();
  const reply = env.send(env.message.prepareToPreview, 7);
  await flush();
  assert.deepEqual(reply, { ready: true });
  const { addRules } = env.lastRules();
  assert.ok(addRules.length > 0);
  for (const rule of addRules) assert.deepEqual(rule.condition.tabIds, [7]);
});

test("the host page's own requests are never rewritten", async () => {
  const env = load();
  env.send(env.message.prepareToPreview, 7);
  await flush();
  for (const rule of env.lastRules().addRules) {
    const touchesSubresources = rule.condition.resourceTypes.some((t) => SUBRESOURCE_TYPES.includes(t));
    if (!touchesSubresources) continue;
    assert.ok(rule.condition.excludedInitiatorDomains?.includes('host.test'),
      `rule ${rule.id} rewrites subresources without excluding the host page`);
    assert.ok(!rule.condition.resourceTypes.includes('sub_frame'), `rule ${rule.id} mixes frames and subresources`);
  }
});

test('each previewing tab excludes its own host', async () => {
  const env = load();
  env.send(env.message.prepareToPreview, 7, 'https://a.test/');
  env.send(env.message.prepareToPreview, 9, 'https://b.test/');
  await flush();
  const subresourceRules = env.lastRules().addRules.filter((r) => r.condition.excludedInitiatorDomains);
  const byTab = Object.fromEntries(subresourceRules.map((r) => [r.condition.tabIds[0], r.condition.excludedInitiatorDomains]));
  assert.deepEqual(byTab, { 7: ['a.test'], 9: ['b.test'] });
});

for (const url of ['file:///tmp/page.html', 'https://[::1]:8443/']) {
  test(`a host without a domain gets no subresource rewriting at all (fail closed): ${url}`, async () => {
    const env = load();
    env.send(env.message.prepareToPreview, 7, url);
    await flush();
    const rules = env.lastRules().addRules;
    assert.ok(rules.length > 0);
    assert.ok(rules.every((r) => !r.condition.resourceTypes.some((t) => SUBRESOURCE_TYPES.includes(t))));
  });
}

test('clearing the last preview removes every rule', async () => {
  const env = load();
  env.send(env.message.prepareToPreview, 7);
  await flush();
  assert.ok((await env.liveRules()).length > 0);
  env.send(env.message.clearPreview, 7);
  await flush();
  assert.deepEqual(await env.liveRules(), []);
});

test('closing one of two previewing tabs keeps only the other tab in the rules', async () => {
  const env = load();
  env.send(env.message.prepareToPreview, 7);
  env.send(env.message.prepareToPreview, 9);
  env.api.tabs.onRemoved.fire(7);
  await flush();
  const tabs = new Set(env.lastRules().addRules.flatMap((r) => r.condition.tabIds));
  assert.deepEqual([...tabs], [9]);
});

// Replays every recorded update against a model of the browser's session rules.
function installedAfter(updates) {
  const rules = new Map();
  for (const { removeRuleIds = [], addRules = [] } of updates) {
    for (const id of removeRuleIds) rules.delete(id);
    for (const rule of addRules) {
      assert.ok(!rules.has(rule.id), `rule id ${rule.id} added twice`);
      rules.set(rule.id, rule);
    }
  }
  return rules;
}

test('no rule is left behind after previews open and close in any order', async () => {
  const env = load();
  env.send(env.message.prepareToPreview, 7);
  env.send(env.message.prepareToPreview, 9);
  env.send(env.message.clearPreview, 7);
  env.send(env.message.prepareToPreview, 11);
  await flush();
  const live = installedAfter(env.api.calls.updateSessionRules);
  assert.deepEqual([...new Set([...live.values()].flatMap((r) => r.condition.tabIds))].sort(), [11, 9]);
  env.send(env.message.clearPreview, 9);
  env.send(env.message.clearPreview, 11);
  await flush();
  assert.equal(installedAfter(env.api.calls.updateSessionRules).size, 0);
});

test('a preview closed after the service worker restarted leaves no rule behind', async () => {
  const persisted = {};
  const first = load(persisted);
  first.send(first.message.prepareToPreview, 7);
  await flush();
  assert.ok((await first.liveRules()).length > 0);

  // The worker idles out and wakes for the message that closes the preview.
  const second = load(persisted);
  second.send(second.message.clearPreview, 7);
  await flush();
  assert.deepEqual(await second.liveRules(), []);
  assert.deepEqual(persisted.session.previewingTabs, []);
});

test('a preview opened after a restart replaces the old rules instead of failing on their ids', async () => {
  const persisted = {};
  const first = load(persisted);
  first.send(first.message.prepareToPreview, 7);
  await flush();
  const second = load(persisted);
  second.send(second.message.prepareToPreview, 9, 'https://other.test/');
  await flush();
  const tabs = new Set((await second.liveRules()).flatMap((r) => r.condition.tabIds));
  assert.deepEqual([...tabs].sort(), [7, 9]);
});

const cookieRewrites = (rules) => rules.filter((r) => r.action.responseHeaders?.some((h) => h.header === 'set-cookie'));

test('a preview still hidden during the hold never downgrades cookies; revealing it does', async () => {
  const env = load();
  env.api.runtime.onMessage.fire({ action: env.message.prepareToPreview, speculative: true },
    { tab: { id: 7, url: 'https://host.test/' }, url: 'https://host.test/' }, () => {});
  await flush();
  assert.equal(cookieRewrites(await env.liveRules()).length, 0);
  env.send(env.message.prepareToPreview, 7);
  await flush();
  assert.ok(cookieRewrites(await env.liveRules()).length > 0);
});

test('the host page rewriting its URL (pushState) keeps the preview; a real navigation ends it', async () => {
  const env = load();
  env.send(env.message.prepareToPreview, 7);
  await flush();
  env.api.tabs.reply = () => ({ alive: true });
  env.api.tabs.onUpdated.fire(7, { url: 'https://host.test/search?page=2' });
  await flush();
  assert.ok((await env.liveRules()).length > 0, 'kept after pushState');
  const ping = env.api.calls.tabsSendMessage.at(-1);
  assert.equal(ping.options.documentId, 'doc-7');

  env.api.tabs.reply = () => { throw new Error('No document with id doc-7'); };
  env.api.tabs.onUpdated.fire(7, { url: 'https://elsewhere.test/' });
  await flush();
  assert.deepEqual(await env.liveRules(), []);
});
