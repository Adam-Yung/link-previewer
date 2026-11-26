// Local HTTPS fixture sites. Chrome maps every *.test host to 127.0.0.1, so host.test and target.test are different sites, the way a
// search page and a result are. Target pages send the headers that normally forbid framing, so a preview only works if the
// extension's header rewriting does.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function selfSignedCert() {
  const dir = mkdtempSync(join(tmpdir(), 'lp-cert-'));
  const key = join(dir, 'key.pem');
  const cert = join(dir, 'cert.pem');
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '2',
    '-subj', '/CN=host.test', '-addext', 'subjectAltName=DNS:host.test,DNS:target.test,DNS:other.test',
  ], { stdio: 'ignore' });
  const pair = { key: readFileSync(key), cert: readFileSync(cert) };
  rmSync(dir, { recursive: true, force: true });
  return pair;
}

const FRAME_FORBIDDING_HEADERS = {
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'",
  'Cross-Origin-Opener-Policy': 'same-origin',
};

function hostPage(origin, query) {
  const filler = Number(query.get('nodes') || 0);
  const rows = Array.from({ length: filler }, (_, i) => `<div class="row" style="transition: color .2s">row ${i}</div>`).join('');
  return `<!doctype html><title>host</title>
<style>body{font:16px sans-serif;margin:0;padding:20px} a{display:inline-block;padding:8px;margin:8px}</style>
<a id="target" href="https://target.test:${origin.port}/page.html">target</a>
<a id="slow" href="https://target.test:${origin.port}/slow.html?ms=400">slow target</a>
<a id="same" href="https://host.test:${origin.port}/other.html">same-site page</a>
<a id="plain" href="https://other.test:${origin.port}/page.html">plain</a>
<div id="spinner" style="width:10px;height:10px;background:#09f;animation:spin 1s linear infinite"></div>
<style>@keyframes spin { to { transform: rotate(360deg) } }</style>
<div id="filler">${rows}</div>
<script>
  window.headerProbe = async () => {
    const res = await fetch('/api/headers', { cache: 'no-store' });
    return { corp: res.headers.get('cross-origin-resource-policy'), xcto: res.headers.get('x-content-type-options') };
  };
</script>`;
}

function targetPage(title, port) {
  return `<!doctype html><title>${title}</title>
<style>body{font:16px sans-serif;margin:0;padding:20px} a{display:inline-block;padding:8px;margin:8px}</style>
<h1>${title}</h1>
<a id="next" href="https://target.test:${port}/page2.html">next page</a>`;
}

export async function startFixtures() {
  const requests = [];
  const server = createServer(selfSignedCert(), (req, res) => {
    const url = new URL(req.url, `https://${req.headers.host}`);
    requests.push({ method: req.method, host: url.hostname, path: url.pathname, at: Date.now() });
    route(url, req, res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  function route(url, req, res) {
    const html = (body, headers = {}) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
      res.end(body);
    };
    if (url.pathname === '/host.html') return html(hostPage({ port }, url.searchParams));
    if (url.pathname === '/other.html') return html(targetPage('same-site', port));
    if (url.pathname === '/page.html') return html(targetPage('target', port), FRAME_FORBIDDING_HEADERS);
    if (url.pathname === '/page2.html') return html(targetPage('target two', port), FRAME_FORBIDDING_HEADERS);
    if (url.pathname === '/slow.html') {
      const delay = Number(url.searchParams.get('ms') || 400);
      return setTimeout(() => html(targetPage('slow', port), FRAME_FORBIDDING_HEADERS), delay);
    }
    if (url.pathname === '/api/headers') {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cross-Origin-Resource-Policy': 'same-origin',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      });
      return res.end('{}');
    }
    res.writeHead(404);
    res.end();
  }

  return {
    port,
    url: (host, path) => `https://${host}:${port}${path}`,
    requests,
    close: () => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }),
  };
}
