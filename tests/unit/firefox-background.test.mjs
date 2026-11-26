import assert from 'node:assert';
import { test } from 'node:test';
import { loadScripts } from '../helpers/sandbox.mjs';

function load() {
  const env = loadScripts(['Common/components/shared.js', 'Firefox/background.js'],
    ['message', 'requestHeadersListener', 'responseHeadersListener']);
  const send = (action, tabId, url = 'https://host.test/search') =>
    env.api.runtime.onMessage.fire({ action, url: 'https://target.test/page' }, { tab: { id: tabId, url }, url }, () => {});
  return { ...env, send };
}

const frameHeaders = () => [
  { name: 'X-Frame-Options', value: 'DENY' },
  { name: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { name: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { name: 'Set-Cookie', value: 'sid=1; SameSite=Strict' },
];
const names = (headers) => headers.map((h) => h.name.toLowerCase());

test('the preview frame of a previewing tab can be framed', () => {
  const env = load();
  env.send(env.message.prepareToPreview, 7);
  const { responseHeaders } = env.responseHeadersListener({
    type: 'sub_frame', tabId: 7, url: 'https://target.test/page', originUrl: 'https://host.test/search', responseHeaders: frameHeaders(),
  });
  assert.ok(!names(responseHeaders).includes('x-frame-options'));
});

test('requests from tabs that are not previewing are untouched', () => {
  const env = load();
  env.send(env.message.prepareToPreview, 7);
  for (const type of ['xmlhttprequest', 'sub_frame']) {
    const original = frameHeaders();
    const { responseHeaders } = env.responseHeadersListener({
      type, tabId: 99, url: 'https://bank.test/api', originUrl: 'https://bank.test/', responseHeaders: frameHeaders(),
    });
    assert.deepEqual(responseHeaders, original, `${type} in another tab was rewritten`);
  }
});

test("the host page's own XHRs are untouched while it previews", () => {
  const env = load();
  env.send(env.message.prepareToPreview, 7);
  const original = frameHeaders();
  const { responseHeaders } = env.responseHeadersListener({
    type: 'xmlhttprequest', tabId: 7, url: 'https://host.test/api', originUrl: 'https://host.test/search', responseHeaders: frameHeaders(),
  });
  assert.deepEqual(responseHeaders, original);
});

test('the previewed page\'s own XHRs keep working (cookies settable inside the preview)', () => {
  const env = load();
  env.send(env.message.prepareToPreview, 7);
  const { responseHeaders } = env.responseHeadersListener({
    type: 'xmlhttprequest', tabId: 7, url: 'https://target.test/api', originUrl: 'https://target.test/page', responseHeaders: frameHeaders(),
  });
  assert.match(responseHeaders.find((h) => h.name.toLowerCase() === 'set-cookie').value, /SameSite=None/);
});

test('after the preview closes nothing is rewritten', () => {
  const env = load();
  env.send(env.message.prepareToPreview, 7);
  env.send(env.message.clearPreview, 7);
  assert.equal(env.api.webRequest.onHeadersReceived.listeners.length, 0);
});

test('navigating the previewing tab away ends its rewriting', () => {
  const env = load();
  env.send(env.message.prepareToPreview, 7);
  env.api.tabs.onUpdated.fire(7, { url: 'https://elsewhere.test/' });
  assert.equal(env.api.webRequest.onHeadersReceived.listeners.length, 0);
});

test('a preview still hidden during the hold never downgrades cookies', () => {
  const env = load();
  env.api.runtime.onMessage.fire({ action: env.message.prepareToPreview, speculative: true },
    { tab: { id: 7, url: 'https://host.test/' }, url: 'https://host.test/' }, () => {});
  const { responseHeaders } = env.responseHeadersListener({
    type: 'sub_frame', tabId: 7, url: 'https://target.test/page', originUrl: 'https://host.test/', responseHeaders: frameHeaders(),
  });
  assert.equal(responseHeaders.find((h) => h.name.toLowerCase() === 'set-cookie').value, 'sid=1; SameSite=Strict');
  assert.ok(!names(responseHeaders).includes('x-frame-options'));
});
