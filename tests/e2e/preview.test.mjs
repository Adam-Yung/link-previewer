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
