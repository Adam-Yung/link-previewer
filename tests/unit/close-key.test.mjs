import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadScripts } from '../helpers/sandbox.mjs';

const { isCloseKey } = loadScripts(['Common/components/shared.js'], ['isCloseKey']);

test('the stored key name matches the keydown key', () => {
  assert.equal(isCloseKey({ key: 'Escape' }, 'Escape'), true);
  assert.equal(isCloseKey({ key: 'q' }, 'Escape'), false);
});

test("the space bar, stored as 'Space', matches the ' ' keydown", () => {
  assert.equal(isCloseKey({ key: ' ' }, 'Space'), true);
  assert.equal(isCloseKey({ key: ' ' }, 'Escape'), false);
});
