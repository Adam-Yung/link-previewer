import assert from 'node:assert';
import { test } from 'node:test';
import { flush, loadScripts } from '../helpers/sandbox.mjs';

function load() {
  const env = loadScripts(['Common/components/shared.js', 'Chrome/background.js'], ['message']);
  const send = (action, tabId, url = 'https://host.test/search?q=x') => {
    let reply;
    env.api.runtime.onMessage.fire({ action }, { tab: { id: tabId, url }, url }, (r) => { reply = r; });
    return reply;
  };
  const lastRules = () => env.api.calls.updateSessionRules.at(-1);
  return { ...env, send, lastRules };
}

const SUBRESOURCES = ['xmlhttprequest', 'script', 'stylesheet', 'image', 'font'];

test('prepareToPreview answers ready and installs rules scoped to that tab only', async () => {
  const env = load();
  assert.deepEqual(env.send(env.message.prepareToPreview, 7), { ready: true });
  await flush();
  const { addRules } = env.lastRules();
  assert.ok(addRules.length > 0);
  for (const rule of addRules) assert.deepEqual(rule.condition.tabIds, [7]);
});

test("the host page's own requests are never rewritten", { todo: 'bug: header leak, fixed in a later commit' }, async () => {
  const env = load();
  env.send(env.message.prepareToPreview, 7);
  await flush();
  for (const rule of env.lastRules().addRules) {
    const touchesSubresources = rule.condition.resourceTypes.some((t) => SUBRESOURCES.includes(t));
    if (!touchesSubresources) continue;
    assert.ok(rule.condition.excludedInitiatorDomains?.includes('host.test'),
      `rule ${rule.id} rewrites subresources without excluding the host page`);
    assert.ok(!rule.condition.resourceTypes.includes('sub_frame'), `rule ${rule.id} mixes frames and subresources`);
  }
});

test('each previewing tab excludes its own host', { todo: 'bug: header leak, fixed in a later commit' }, async () => {
  const env = load();
  env.send(env.message.prepareToPreview, 7, 'https://a.test/');
  env.send(env.message.prepareToPreview, 9, 'https://b.test/');
  await flush();
  const subresourceRules = env.lastRules().addRules.filter((r) => r.condition.excludedInitiatorDomains);
  const byTab = Object.fromEntries(subresourceRules.map((r) => [r.condition.tabIds[0], r.condition.excludedInitiatorDomains]));
  assert.deepEqual(byTab, { 7: ['a.test'], 9: ['b.test'] });
});

test('a host without a domain gets no subresource rewriting at all (fail closed)', { todo: 'bug: header leak, fixed in a later commit' }, async () => {
  const env = load();
  env.send(env.message.prepareToPreview, 7, 'file:///tmp/page.html');
  await flush();
  const rules = env.lastRules().addRules;
  assert.ok(rules.every((r) => !r.condition.resourceTypes.some((t) => SUBRESOURCES.includes(t))));
});

test('clearing the last preview removes every rule', async () => {
  const env = load();
  env.send(env.message.prepareToPreview, 7);
  env.send(env.message.clearPreview, 7);
  await flush();
  const last = env.lastRules();
  assert.equal(last.addRules, undefined);
  assert.ok(last.removeRuleIds.length >= 2);
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

test('rule ids removed always cover the ids previously added', async () => {
  const env = load();
  env.send(env.message.prepareToPreview, 7);
  env.send(env.message.prepareToPreview, 9);
  await flush();
  const added = env.lastRules().addRules.map((r) => r.id);
  env.send(env.message.clearPreview, 7);
  env.send(env.message.clearPreview, 9);
  await flush();
  const removed = env.lastRules().removeRuleIds;
  for (const id of added) assert.ok(removed.includes(id), `rule ${id} left behind`);
});
