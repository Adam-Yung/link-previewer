import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { ROOT } from '../helpers/sandbox.mjs';

// The build runs in a scratch copy so it can never touch the working tree's out/ or anything else.
const work = mkdtempSync(join(tmpdir(), 'lp-build-'));
for (const dir of ['tools', 'Common', 'Chrome', 'Firefox']) cpSync(join(ROOT, dir), join(work, dir), { recursive: true });
cpSync(join(ROOT, 'package.json'), join(work, 'package.json'));
after(() => rmSync(work, { recursive: true, force: true }));

const build = (target) => execFileSync(join(work, 'tools/build.sh'), [target], { cwd: work, stdio: 'ignore' });
const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;

function jsFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? jsFiles(join(dir, e.name)) : e.name.endsWith('.js') ? [join(dir, e.name)] : []);
}

test('clean removes only build output, never zips elsewhere in the tree', { todo: 'bug: clean deletes every zip, fixed in a later commit' }, () => {
  mkdirSync(join(work, 'keep'), { recursive: true });
  writeFileSync(join(work, 'keep/archive.zip'), 'not ours');
  build('chrome');
  assert.ok(existsSync(join(work, 'keep/archive.zip')));
});

test('chrome build stamps the version and prepends the shared message names to background.js', () => {
  build('chrome');
  const manifest = JSON.parse(readFileSync(join(work, 'out/dist/manifest.json'), 'utf8'));
  assert.equal(manifest.version, version);
  assert.equal(manifest.manifest_version, 3);
  assert.match(readFileSync(join(work, 'out/dist/background.js'), 'utf8'), /^\/\*\*[\s\S]*const message = \{/);
  assert.ok(existsSync(join(work, `out/link-previewer-chrome-v${version}.zip`)));
});

test('firefox build has no chrome.* API calls left', () => {
  build('firefox');
  const manifest = JSON.parse(readFileSync(join(work, 'out/dist/manifest.json'), 'utf8'));
  assert.equal(manifest.manifest_version, 2);
  for (const file of jsFiles(join(work, 'out/dist'))) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /\bchrome\.(runtime|storage|tabs|declarativeNetRequest)\b/, file);
  }
});
