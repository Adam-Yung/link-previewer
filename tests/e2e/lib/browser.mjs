// Launches Chrome (Chrome for Testing, or an installed Google Chrome through LP_CHROME) in a throwaway profile, installs the unpacked
// extension through Extensions.loadUnpacked (the installer chrome://extensions' Load unpacked uses; branded Chrome ignores
// --load-extension), and wraps the CDP calls the e2e suite needs.
// Never point this at the user's own Chrome: the profile is fresh and deleted on close.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { Cdp } from './cdp.mjs';

export function findChrome() {
  if (process.env.LP_CHROME) return existsSync(process.env.LP_CHROME) ? process.env.LP_CHROME : null;
  const cache = join(homedir(), 'Library/Caches/ms-playwright');
  if (!existsSync(cache)) return null;
  const builds = readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse();
  for (const build of builds) {
    const bin = join(cache, build, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
    if (existsSync(bin)) return bin;
  }
  return null;
}

export async function launchBrowser(extensionDir) {
  const bin = findChrome();
  if (!bin) throw new Error('Chrome not found (install Chrome for Testing via Playwright, or set LP_CHROME)');
  const profile = mkdtempSync(join(tmpdir(), 'lp-profile-'));
  const proc = spawn(bin, [
    '--headless=new',
    `--user-data-dir=${profile}`,
    '--remote-debugging-pipe',
    '--enable-unsafe-extension-debugging',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-sync',
    '--ignore-certificate-errors',
    '--host-resolver-rules=MAP *.test 127.0.0.1',
    '--window-size=1280,900',
  ], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
  const cdp = new Cdp(proc.stdio[3], proc.stdio[4]);
  await cdp.send('Extensions.loadUnpacked', { path: extensionDir });
  await cdp.send('Target.setDiscoverTargets', { discover: true });
  return new Browser(cdp, proc, profile);
}

class Browser {
  constructor(cdp, proc, profile) {
    this.cdp = cdp;
    this.proc = proc;
    this.profile = profile;
  }

  async serviceWorker() {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const { targetInfos } = await this.cdp.send('Target.getTargets');
      // Chrome for Testing runs built-in component extensions too; pick ours by its manifest name.
      const workers = targetInfos.filter((t) => t.type === 'service_worker' && t.url.startsWith('chrome-extension://'));
      for (const sw of workers) {
        const { sessionId } = await this.cdp.send('Target.attachToTarget', { targetId: sw.targetId, flatten: true });
        const session = new Session(this.cdp, sessionId);
        const name = await session.eval('chrome.runtime.getManifest().name', 1000).catch(() => null);
        if (name === 'Link Previewer') return session;
        await this.cdp.send('Target.detachFromTarget', { sessionId });
      }
      await sleep(100);
    }
    throw new Error('extension service worker not found: did the extension load?');
  }

  async newPage(url) {
    const { targetId } = await this.cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await this.cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const page = new Session(this.cdp, sessionId, targetId);
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
    if (url) await page.goto(url);
    return page;
  }

  // Tests close their tabs so frame lookups by URL cannot find a frame left over from an earlier test.
  async closePages() {
    const { targetInfos } = await this.cdp.send('Target.getTargets');
    for (const t of targetInfos.filter((t) => t.type === 'page')) {
      await this.cdp.send('Target.closeTarget', { targetId: t.targetId }).catch(() => {});
    }
  }

  async close() {
    this.cdp.close();
    this.proc.kill('SIGKILL');
    await sleep(200);
    rmSync(this.profile, { recursive: true, force: true });
  }
}

class Session {
  constructor(cdp, sessionId, targetId) {
    this.cdp = cdp;
    this.sessionId = sessionId;
    this.targetId = targetId;
  }

  send(method, params = {}) {
    return this.cdp.send(method, params, this.sessionId);
  }

  async goto(url) {
    const loaded = this.cdp.waitFor('Page.loadEventFired', (m) => m.sessionId === this.sessionId);
    await this.send('Page.navigate', { url });
    await loaded;
    // Content scripts run at document_idle; give them a beat after load.
    await sleep(150);
  }

  async eval(expression, timeoutMs = 5000) {
    const reply = this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    const timeout = sleep(timeoutMs).then(() => { throw new Error(`eval timed out: ${expression.slice(0, 60)}`); });
    const { result, exceptionDetails } = await Promise.race([reply, timeout]);
    if (exceptionDetails) throw new Error(`eval failed: ${exceptionDetails.exception?.description || exceptionDetails.text}`);
    return result.value;
  }

  async center(selector) {
    const box = await this.eval(`(() => {
      const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    if (!box) throw new Error(`no element ${selector}`);
    return box;
  }

  mouse(type, x, y, extra = {}) {
    return this.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, ...extra });
  }

  async longPress(selector, holdMs, { moveBy = 0 } = {}) {
    const { x, y } = await this.center(selector);
    await this.mouse('mouseMoved', x, y, { button: 'none' });
    await this.mouse('mousePressed', x, y, { buttons: 1 });
    if (moveBy) await this.mouse('mouseMoved', x + moveBy, y + moveBy, { buttons: 1 });
    await sleep(holdMs);
    await this.mouse('mouseReleased', x + moveBy, y + moveBy);
  }

  async click(selector, { modifiers = 0, button = 'left' } = {}) {
    const { x, y } = await this.center(selector);
    const buttons = button === 'right' ? 2 : 1;
    await this.mouse('mouseMoved', x, y, { button: 'none', modifiers });
    await this.mouse('mousePressed', x, y, { button, buttons, modifiers });
    await this.mouse('mouseReleased', x, y, { button, modifiers });
  }

  key(key, code = key) {
    return Promise.all([
      this.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: key === 'Escape' ? 27 : 0 }),
      this.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code }),
    ]);
  }

  // The preview iframe is cross-site, so it is an out-of-process frame with its own CDP session.
  // Resolves once the extension's content scripts have an execution context in this frame (Runtime.enable replays existing ones).
  async extensionWorld(timeoutMs = 5000) {
    const ready = this.cdp.waitFor('Runtime.executionContextCreated',
      (m) => m.sessionId === this.sessionId && m.params.context.auxData?.type === 'isolated', timeoutMs);
    await this.send('Runtime.enable');
    await ready;
  }

  // Returns null if no such frame appears in time.
  async frameSession(urlPrefix, timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const { targetInfos } = await this.cdp.send('Target.getTargets');
      const frame = targetInfos.find((t) => t.type === 'iframe' && t.url.startsWith(urlPrefix));
      if (frame) {
        const { sessionId } = await this.cdp.send('Target.attachToTarget', { targetId: frame.targetId, flatten: true });
        return new Session(this.cdp, sessionId, frame.targetId);
      }
      await sleep(25);
    }
    return null;
  }
}
