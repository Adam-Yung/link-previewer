import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadScripts } from '../helpers/sandbox.mjs';

function withSystem(dark) {
  const window = { matchMedia: (q) => ({ matches: dark && q === '(prefers-color-scheme: dark)' }) };
  return loadScripts(['Common/components/shared.js'], ['resolveTheme'], { window }).resolveTheme;
}

test("'auto' follows the system appearance", () => {
  assert.equal(withSystem(true)('auto'), 'dark');
  assert.equal(withSystem(false)('auto'), 'light');
});

test('an explicit choice wins over the system', () => {
  assert.equal(withSystem(true)('light'), 'light');
  assert.equal(withSystem(false)('dark'), 'dark');
});

test('the default theme is auto', () => {
  const { settings } = loadScripts(['Common/components/global.js'], ['settings']);
  assert.equal(settings.theme, 'auto');
});
