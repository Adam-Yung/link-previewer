// End-to-end checks on the real extension in Chrome for Testing. Run with `npm run e2e` (builds the Chrome target first).
import assert from 'node:assert/strict';
import { after, afterEach, before, test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { HOLD_MS, clearStorage, previewState, setup, teardown, waitUntil } from './lib/harness.mjs';

let env;
before(async () => { env = await setup(); });
after(async () => { await teardown(env); });
afterEach(async () => { await env.browser.closePages(); });

async function openHost(path = '/host.html') {
  await clearStorage(env.worker);
  return env.browser.newPage(env.fixtures.url('host.test', path));
}

async function openPreview(page, selector = '#target', path = '/page.html') {
  await page.longPress(selector, HOLD_MS + 150);
  const frame = await page.frameSession(env.fixtures.url('target.test', path));
  assert.ok(frame, 'preview iframe appeared');
  await frame.extensionWorld();
  return frame;
}

test('long press previews a page that forbids framing', async () => {
  const page = await openHost();
  const frame = await openPreview(page);
  assert.equal(await frame.eval('document.title'), 'target');
});

test('a short click does not open a preview', async () => {
  const page = await openHost();
  await page.longPress('#same', 60);
  await sleep(HOLD_MS + 200);
  // The click navigates the tab to the link, which is the browser's normal behaviour.
  assert.match(await page.eval('location.href'), /host\.test.*other\.html/);
});

const liveRules = () => env.worker.eval('chrome.declarativeNetRequest.getSessionRules()');
const hostState = (page) => page.eval(`(() => {
  const host = document.getElementById('link-preview-host');
  if (!host) return null;
  return { visibility: getComputedStyle(host).visibility, src: host.shadowRoot.getElementById('link-preview-iframe')?.getAttribute('src') };
})()`);

test('late in the hold the preview is already loading, hidden and without cookie rewriting', async () => {
  const page = await openHost();
  const { x, y } = await page.center('#target');
  await page.mouse('mouseMoved', x, y, { button: 'none' });
  await page.mouse('mousePressed', x, y, { buttons: 1 });
  await sleep(HOLD_MS - 80);
  const hidden = await hostState(page);
  const rules = await liveRules();
  await page.mouse('mouseReleased', x, y);
  assert.equal(hidden?.visibility, 'hidden');
  assert.match(hidden?.src || '', /\/page\.html$/);
  assert.ok(rules.length > 0, 'header rules on for the hidden preview');
  assert.ok(rules.every((r) => !r.action.responseHeaders?.some((h) => h.header === 'set-cookie')), 'no cookie rewriting yet');
});

test('a shown preview gets the full header rules', async () => {
  const page = await openHost();
  await openPreview(page);
  const rules = await waitUntil(async () => {
    const live = await liveRules();
    return live.some((r) => r.action.responseHeaders?.some((h) => h.header === 'set-cookie')) ? live : null;
  });
  assert.ok(rules, 'cookie rule installed after reveal');
});

test('a press released late on an in-app link (no navigation) leaves no preview or header rule behind', async () => {
  const page = await openHost();
  await page.longPress('#spa', HOLD_MS - 80);
  assert.ok(await waitUntil(async () => (await hostState(page)) === null), 'hidden preview removed');
  assert.ok(await waitUntil(async () => (await liveRules()).length === 0), 'header rules removed');
});

test('a hidden preview closed from inside before the hold ends is not revealed later', async () => {
  const page = await openHost();
  await env.worker.eval(`chrome.storage.local.set({ isExpanded: true, duration: 2500 })`);
  const { x, y } = await page.center('#target');
  await page.mouse('mouseMoved', x, y, { button: 'none' });
  await page.mouse('mousePressed', x, y, { buttons: 1 });
  // Loading starts at 2250 ms; close it from inside the frame before the hold ends at 2500 ms.
  const frame = await page.frameSession(env.fixtures.url('target.test', '/page.html'), 2400);
  assert.ok(frame, 'hidden preview loading');
  await frame.extensionWorld();
  await frame.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await sleep(600);
  await page.mouse('mouseReleased', x, y);
  assert.equal((await previewState(page)).open, false);
  assert.equal(await page.eval('getComputedStyle(document.body).pointerEvents'), 'auto', 'host page left usable');
});

test('a press released mid-hold follows the link and leaves no preview or header rule behind', async () => {
  const page = await openHost();
  await page.longPress('#target', HOLD_MS - 80);
  await waitUntil(async () => (await page.eval('location.href')).includes('target.test'));
  assert.match(await page.eval('location.href'), /target\.test.*page\.html/);
  const rules = await waitUntil(async () => (await env.worker.eval('chrome.declarativeNetRequest.getSessionRules()')).length === 0);
  assert.ok(rules, 'header rules removed');
});

test('hovering links sends no requests', async () => {
  const page = await openHost();
  const since = Date.now();
  for (const selector of ['#target', '#slow', '#plain']) {
    const { x, y } = await page.center(selector);
    await page.mouse('mouseMoved', x, y, { button: 'none' });
    await sleep(250);
  }
  assert.deepEqual(env.fixtures.requests.filter((r) => r.at >= since), []);
});

test('host page headers untouched while a preview is open', async () => {
  const page = await openHost();
  const before = await page.eval('window.headerProbe()');
  assert.deepEqual(before, { corp: 'same-origin', xcto: 'nosniff' });
  await openPreview(page);
  assert.deepEqual(await page.eval('window.headerProbe()'), before);
});

test('escape closes the preview and restores the host page', async () => {
  const page = await openHost();
  await openPreview(page);
  await page.key('Escape');
  assert.ok(await waitUntil(async () => !(await previewState(page)).open), 'preview closed');
  assert.equal(await page.eval('getComputedStyle(document.body).pointerEvents'), 'auto');
  assert.deepEqual(await page.eval('window.headerProbe()'), { corp: 'same-origin', xcto: 'nosniff' });
});

// Synthetic events from the frame's page world reach the extension's capture listeners the same way real ones do; a real right-click
// would open a context menu that blocks headless input.
async function pressInFrame(frame, selector, init) {
  await frame.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, ...${JSON.stringify(init)} }));
  })()`);
}

test('with default settings the preview follows a dark system appearance', async () => {
  const page = await openHost();
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await openPreview(page);
  const classes = await page.eval(`document.getElementById('link-preview-host').shadowRoot.getElementById('link-preview-container').className`);
  assert.match(classes, /\bdark\b/);
});

test('the settings page shows the system theme by default and saves auto unless the switch is flipped', async () => {
  await clearStorage(env.worker);
  const id = await env.worker.eval('chrome.runtime.id');
  const page = await env.browser.newPage();
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await page.goto(`chrome-extension://${id}/options/options.html`);
  assert.equal(await page.eval(`document.getElementById('theme-toggle').checked`), true);
  await page.eval(`document.getElementById('save-button').click()`);
  const theme = await waitUntil(async () => (await env.worker.eval(`chrome.storage.local.get('theme')`)).theme);
  assert.equal(theme, 'auto');
});

test('center stage pauses the host page animations and resumes them on close', async () => {
  const page = await openHost();
  await env.worker.eval(`chrome.storage.local.set({ isExpanded: true })`);
  const spinner = `document.getElementById('spinner').getAnimations()[0].playState`;
  assert.equal(await page.eval(spinner), 'running');
  await openPreview(page);
  assert.equal(await page.eval(spinner), 'paused');
  await page.key('Escape');
  await waitUntil(async () => !(await previewState(page)).open);
  assert.equal(await page.eval(spinner), 'running');
});

test('a close key set to Space closes the preview', async () => {
  const page = await openHost();
  await env.worker.eval(`chrome.storage.local.set({ closeKey: 'Space' })`);
  await openPreview(page);
  await page.key(' ', 'Space');
  assert.ok(await waitUntil(async () => !(await previewState(page)).open), 'preview closed');
});

test('clicking a link inside the preview navigates the preview', async () => {
  const page = await openHost();
  const frame = await openPreview(page);
  await pressInFrame(frame, '#next', { button: 0 });
  const state = await waitUntil(async () => {
    const s = await previewState(page);
    return s.src?.endsWith('/page2.html') ? s : null;
  });
  assert.ok(state, 'preview moved to page2');
});

for (const [name, init] of [['right-click', { button: 2 }], ['middle-click', { button: 1 }], ['ctrl-click', { button: 0, ctrlKey: true }],
  ['cmd-click', { button: 0, metaKey: true }]]) {
  test(`${name} on a link inside the preview leaves the preview where it is`, async () => {
    const page = await openHost();
    const frame = await openPreview(page);
    await pressInFrame(frame, '#next', init);
    // A wrong navigation goes frame -> background -> tab -> new iframe; a second is ample for it to show.
    await sleep(1000);
    assert.match((await previewState(page)).src, /\/page\.html$/);
  });
}

test('moving the mouse while holding a link does not open a preview (drag or text selection)', async () => {
  const page = await openHost();
  await page.longPress('#target', HOLD_MS + 150, { moveBy: 40 });
  await sleep(100);
  assert.equal((await previewState(page)).open, false);
});

test('holding the middle button on a link does not open a preview', async () => {
  const page = await openHost();
  await page.eval(`document.addEventListener('auxclick', (e) => e.preventDefault(), true)`);
  const { x, y } = await page.center('#target');
  await page.mouse('mouseMoved', x, y, { button: 'none' });
  await page.mouse('mousePressed', x, y, { button: 'middle', buttons: 4 });
  await sleep(HOLD_MS + 150);
  await page.mouse('mouseReleased', x, y, { button: 'middle' });
  assert.equal((await previewState(page)).open, false);
});

test('modifier click on a disabled site follows the link normally', async () => {
  const page = await openHost();
  await env.worker.eval(`chrome.storage.local.set({ disabledSites: ['host.test'] })`);
  await sleep(100);
  await page.click('#plain', { modifiers: 8 /* Shift */ });
  await sleep(400);
  assert.equal((await previewState(page)).open, false);
  // Shift+click opens a new window in Chrome; the host page must not have swallowed the click.
  const { targetInfos } = await env.browser.cdp.send('Target.getTargets');
  assert.ok(targetInfos.some((t) => t.type === 'page' && t.url.includes('other.test')), 'link opened');
});
