// Shared setup for the e2e files: one fixture server and one browser per file, plus the page-level probes the tests read.
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser } from './browser.mjs';
import { startFixtures } from './fixtures.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
export const DIST = join(ROOT, 'out/dist');
export const HOLD_MS = 500; // the extension's default long-press duration

export function buildChrome() {
  if (process.env.LP_SKIP_BUILD) return;
  execFileSync(join(ROOT, 'tools/build.sh'), ['chrome'], { cwd: ROOT, stdio: 'ignore' });
}

export async function setup() {
  buildChrome();
  const fixtures = await startFixtures();
  const browser = await launchBrowser(DIST);
  const worker = await browser.serviceWorker();
  return { fixtures, browser, worker };
}

export async function teardown({ fixtures, browser }) {
  await browser.close();
  await fixtures.close();
}

export const previewState = (page) => page.eval(`(() => {
  const host = document.getElementById('link-preview-host');
  const frame = host?.shadowRoot.getElementById('link-preview-iframe');
  return { open: !!host, src: frame?.src || null, url: host?.shadowRoot.querySelector('.link-preview-url')?.textContent || null };
})()`);

export async function waitUntil(fn, timeoutMs = 5000, stepMs = 25) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await fn();
    if (value) return value;
    await sleep(stepMs);
  }
  return null;
}

// Page coordinates of an element inside the preview iframe, so mouse input can be aimed at it from the top-level page.
export async function pointInPreview(page, frame, selector) {
  const box = await page.eval(`(() => {
    const r = document.getElementById('link-preview-host').shadowRoot.getElementById('link-preview-iframe').getBoundingClientRect();
    return { x: r.left, y: r.top };
  })()`);
  const inner = await frame.center(selector);
  return { x: box.x + inner.x, y: box.y + inner.y };
}

export async function clearStorage(worker) {
  await worker.eval('chrome.storage.local.clear()');
}
