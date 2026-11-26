// Firefox smoke test: the MV2 build in a real Firefox, driven over WebDriver BiDi against the local HTTPS fixtures.
//   node tests/e2e/firefox-smoke.mjs          (builds the Firefox target into out/dist first; LP_SKIP_BUILD=1 reuses it)
//   LP_FIREFOX=<binary> overrides /Applications/Firefox.app; LP_SHOTS=<dir> saves a screenshot of the open preview.
// Not in the gate: it needs a Firefox install, and the build replaces the Chrome target in out/dist. Exits non-zero on any failure.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { DIST, ROOT, waitUntil } from './lib/harness.mjs';
import { startFixtures } from './lib/fixtures.mjs';

const FIREFOX = process.env.LP_FIREFOX || '/Applications/Firefox.app/Contents/MacOS/firefox';
const PORT = 9333;
const ESCAPE = '';
const SHIFT = '';

class Bidi {
  static async connect(url) {
    for (let i = 0; i < 100; i++) {
      try {
        const ws = new WebSocket(url);
        await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
        return new Bidi(ws);
      } catch { await sleep(200); }
    }
    throw new Error('Firefox did not open its BiDi port');
  }

  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.type === 'error') p.fail(new Error(`${msg.error}: ${msg.message}`));
      else p.ok(msg.result);
    };
  }

  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((ok, fail) => {
      this.pending.set(id, { ok, fail });
      setTimeout(() => { if (this.pending.delete(id)) fail(new Error(`${method} timed out`)); }, 20000);
    });
  }
}

function launchFirefox() {
  const profile = mkdtempSync(join(tmpdir(), 'lp-ff-'));
  // localDomains maps the fixture hosts to 127.0.0.1, as Chrome's host-resolver rule does in the Chrome suite.
  const prefs = {
    'network.dns.localDomains': 'host.test,target.test,other.test',
    'network.trr.mode': 5,
    'browser.shell.checkDefaultBrowser': false,
    'browser.startup.homepage_override.mstone': 'ignore',
    'datareporting.policy.dataSubmissionEnabled': false,
    'toolkit.telemetry.reportingpolicy.firstRun': false,
    'app.update.disabledForTesting': true,
    'browser.aboutwelcome.enabled': false,
  };
  writeFileSync(join(profile, 'user.js'),
    Object.entries(prefs).map(([k, v]) => `user_pref(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join('\n'));
  const proc = spawn(FIREFOX, ['--headless', '--no-remote', '--profile', profile, `--remote-debugging-port=${PORT}`,
    '--width=1280', '--height=900'], { stdio: 'ignore' });
  return { proc, profile };
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`);
}

async function run(bidi, fixtures) {
  const session = await bidi.send('session.new', { capabilities: { alwaysMatch: { acceptInsecureCerts: true } } });
  console.log(`Firefox ${session.capabilities.browserVersion}`);
  await bidi.send('webExtension.install', { extensionData: { type: 'path', path: DIST } });
  const { context: ctx } = await bidi.send('browsingContext.create', { type: 'tab' });

  const evalIn = async (context, expr) => {
    const r = await bidi.send('script.evaluate', {
      expression: `Promise.resolve(${expr}).then((v) => JSON.stringify(v ?? null))`, target: { context }, awaitPromise: true,
    });
    if (r.type === 'exception') throw new Error(r.exceptionDetails.text);
    return JSON.parse(r.result.value);
  };
  const evalPage = (expr) => evalIn(ctx, expr);
  const tryUntil = (fn, ms) => waitUntil(() => fn().catch(() => null), ms, 50);
  const centerIn = (context, sel) => evalIn(context, `(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
  const pointer = (context, steps) => bidi.send('input.performActions', {
    context, actions: [{ type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' }, actions: steps }],
  });
  const press = async ({ x, y }, holdMs, keys = []) => {
    const actions = [{ type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' }, actions: [
      { type: 'pointerMove', x, y }, { type: 'pointerDown', button: 0 }, { type: 'pause', duration: holdMs }, { type: 'pointerUp', button: 0 }] }];
    if (keys.length) {
      actions.push({ type: 'key', id: 'kb', actions: [...keys.map((value) => ({ type: 'keyDown', value })),
        { type: 'pause' }, { type: 'pause' }, ...keys.map((value) => ({ type: 'keyUp', value }))] });
    }
    await bidi.send('input.performActions', { context: ctx, actions });
    await bidi.send('input.releaseActions', { context: ctx });
  };
  const key = (value) => bidi.send('input.performActions', {
    context: ctx, actions: [{ type: 'key', id: 'kb', actions: [{ type: 'keyDown', value }, { type: 'keyUp', value }] }],
  });
  const preview = () => evalPage(`(() => { const h = document.getElementById('link-preview-host');
    const f = h?.shadowRoot?.getElementById('link-preview-iframe');
    return { open: !!h, visible: !!h && getComputedStyle(h).visibility !== 'hidden', src: f?.getAttribute('src') || null }; })()`);
  const frameTitled = (title) => tryUntil(async () => {
    const { contexts } = await bidi.send('browsingContext.getTree', { root: ctx });
    const frame = contexts[0].children?.[0];
    return frame && (await evalIn(frame.context, 'document.title')) === title ? frame : null;
  }, 8000);
  const openHost = async () => {
    await bidi.send('browsingContext.navigate', { context: ctx, url: fixtures.url('host.test', '/host.html'), wait: 'complete' });
    await sleep(800); // content scripts run at document_idle and then read settings
  };

  await openHost();
  await press(await centerIn(ctx, '#target'), 800);
  const opened = await tryUntil(async () => { const p = await preview(); return p.visible && p.src ? p : null; }, 5000);
  check('long press opens a visible preview', opened, opened?.src || '');
  const loaded = await frameTitled('target');
  check('a frame-forbidding page loads inside the preview', loaded);
  if (process.env.LP_SHOTS) {
    const { data } = await bidi.send('browsingContext.captureScreenshot', { context: ctx });
    writeFileSync(join(process.env.LP_SHOTS, 'firefox-preview.png'), Buffer.from(data, 'base64'));
  }

  const headers = await evalPage('headerProbe()');
  check('the host page keeps CORP and nosniff while previewing', headers?.corp === 'same-origin' && headers?.xcto === 'nosniff', JSON.stringify(headers));

  if (loaded) {
    // Firefox BiDi input aimed at the top-level context stops at a cross-origin (out-of-process) iframe element, so the click goes
    // to the frame's own context. The click navigates the preview, which replaces that context mid-action: that error is expected.
    const at = await centerIn(loaded.context, '#next');
    await pointer(loaded.context, [{ type: 'pointerMove', x: at.x, y: at.y }, { type: 'pointerDown', button: 0 },
      { type: 'pause', duration: 60 }, { type: 'pointerUp', button: 0 }]).catch(() => {});
    await bidi.send('input.releaseActions', { context: loaded.context }).catch(() => {});
    check('a click inside the preview navigates the preview', await frameTitled('target two'));
  }

  await key(ESCAPE);
  check('the close key closes the preview', await tryUntil(async () => !(await preview()).open, 3000));

  await openHost();
  await press(await centerIn(ctx, '#plain'), 60, [SHIFT]);
  const shifted = await tryUntil(async () => { const p = await preview(); return p.visible ? p : null; }, 5000);
  check('shift+click opens a preview without following the link', shifted && (await evalPage('location.pathname')) === '/host.html');
  await key(ESCAPE);

  await openHost();
  const before = Date.now();
  await press(await centerIn(ctx, '#slow'), 120);
  const followed = await tryUntil(async () => (await evalPage('location.pathname')) === '/slow.html', 5000);
  const hits = fixtures.requests.filter((r) => r.at >= before && r.path === '/slow.html').length;
  check('a short click follows the link with a single request', followed && hits === 1, `requests=${hits}`);

  await openHost();
  const c = await centerIn(ctx, '#target');
  await pointer(ctx, [{ type: 'pointerMove', x: c.x, y: c.y }, { type: 'pointerDown', button: 0 },
    { type: 'pointerMove', x: c.x + 60, y: c.y + 40, duration: 100 }, { type: 'pause', duration: 700 }, { type: 'pointerUp', button: 0 }]);
  await bidi.send('input.releaseActions', { context: ctx });
  await sleep(400);
  check('dragging from a link opens no preview', !(await preview()).open);
}

if (!process.env.LP_SKIP_BUILD) execFileSync(join(ROOT, 'tools/build.sh'), ['firefox'], { cwd: ROOT, stdio: 'ignore' });
const fixtures = await startFixtures();
const { proc, profile } = launchFirefox();
let bidi;
try {
  bidi = await Bidi.connect(`ws://127.0.0.1:${PORT}/session`);
  await run(bidi, fixtures);
} catch (err) {
  check('run completed', false, String(err?.stack || err));
} finally {
  await bidi?.send('session.end').catch(() => {});
  proc.kill();
  await fixtures.close();
  await sleep(500);
  rmSync(profile, { recursive: true, force: true });
}
const failed = results.filter((r) => !r.ok).length;
console.log(`firefox smoke: ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
