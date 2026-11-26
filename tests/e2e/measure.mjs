// Performance spike: measures the real extension in Chrome for Testing against the local fixture sites and prints JSON.
//   node tests/e2e/measure.mjs [runs]        (builds the Chrome target first; LP_SKIP_BUILD=1 to reuse out/dist)
// Not part of the gate: numbers vary by machine. Results and their reading live in docs/features/performance.md.
import { setTimeout as sleep } from 'node:timers/promises';
import { HOLD_MS, clearStorage, setup, teardown, waitUntil } from './lib/harness.mjs';

const RUNS = Number(process.argv[2] || 8);

// Page-world probe: mousedown time, when the preview UI appears, when the iframe gets its src, when the iframe fires load.
const INSTRUMENT = `(() => {
  const t = window.__lp = {};
  document.addEventListener('mousedown', () => { t.down = performance.now(); }, true);
  const tick = () => {
    const host = document.getElementById('link-preview-host');
    const frame = host?.shadowRoot?.getElementById('link-preview-iframe');
    if (host && t.host === undefined) t.host = performance.now();
    if (frame?.getAttribute('src') && t.src === undefined) {
      t.src = performance.now();
      frame.addEventListener('load', () => { t.load = performance.now(); }, { once: true });
    }
    if (t.load === undefined) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})()`;

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? Math.round(s[Math.floor(s.length / 2)]) : null;
};

async function openLatency(env, selector) {
  const samples = [];
  for (let i = 0; i < RUNS; i++) {
    await clearStorage(env.worker);
    const page = await env.browser.newPage(env.fixtures.url('host.test', '/host.html'));
    await page.eval(INSTRUMENT);
    await page.longPress(selector, HOLD_MS + 100);
    const t = await waitUntil(() => page.eval('window.__lp.load !== undefined && window.__lp'), 8000);
    if (t) samples.push({ ui: t.host - t.down, src: t.src - t.down, load: t.load - t.down });
    await env.browser.closePages();
  }
  return {
    runs: samples.length,
    uiShownMs: median(samples.map((s) => s.ui)),
    srcSetMs: median(samples.map((s) => s.src)),
    loadedMs: median(samples.map((s) => s.load)),
    afterHoldLoadedMs: median(samples.map((s) => s.load - HOLD_MS)),
  };
}

async function hoverRequests(env) {
  await clearStorage(env.worker);
  const page = await env.browser.newPage(env.fixtures.url('host.test', '/host.html'));
  const start = Date.now();
  for (const selector of ['#target', '#slow', '#same', '#plain']) {
    const { x, y } = await page.center(selector);
    await page.mouse('mouseMoved', x, y, { button: 'none' });
    await sleep(250);
  }
  await sleep(300);
  const hits = env.fixtures.requests.filter((r) => r.at >= start);
  await env.browser.closePages();
  return { linksHovered: 4, requestsSent: hits.length, methods: [...new Set(hits.map((r) => r.method))] };
}

async function metric(page, name) {
  const { metrics } = await page.send('Performance.getMetrics');
  return metrics.find((m) => m.name === name).value * 1000;
}

async function styleCost(env, centerStage) {
  const samples = [];
  for (let i = 0; i < Math.min(RUNS, 5); i++) {
    await clearStorage(env.worker);
    await env.worker.eval(`chrome.storage.local.set({ isExpanded: ${centerStage} })`);
    const page = await env.browser.newPage(env.fixtures.url('host.test', '/host.html?nodes=20000'));
    await page.send('Performance.enable');
    await page.eval(INSTRUMENT);
    const before = { style: await metric(page, 'RecalcStyleDuration'), layout: await metric(page, 'LayoutDuration') };
    await page.longPress('#target', HOLD_MS + 100);
    await waitUntil(() => page.eval('window.__lp.load !== undefined'), 8000);
    await sleep(300);
    await page.key('Escape');
    await sleep(400);
    samples.push({
      style: await metric(page, 'RecalcStyleDuration') - before.style,
      layout: await metric(page, 'LayoutDuration') - before.layout,
    });
    await env.browser.closePages();
  }
  return { hostNodes: 20000, recalcStyleMs: median(samples.map((s) => s.style)), layoutMs: median(samples.map((s) => s.layout)) };
}

const env = await setup();
try {
  const result = {
    holdMs: HOLD_MS,
    fastPage: await openLatency(env, '#target'),
    slowPage400ms: await openLatency(env, '#slow'),
    hover: await hoverRequests(env),
    openCloseCost: { pocket: await styleCost(env, false), centerStage: await styleCost(env, true) },
  };
  console.log(JSON.stringify(result, null, 2));
} finally {
  await teardown(env);
}
