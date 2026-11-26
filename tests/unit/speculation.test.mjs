import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadScripts } from '../helpers/sandbox.mjs';

const document = { addEventListener: () => {} };
const { speculationDelay } = loadScripts(['Common/components/global.js', 'Common/content.js'], ['speculationDelay'], { document });

test('loading starts 250 ms before the hold ends, never before 300 ms into the press', () => {
  assert.equal(speculationDelay(500), 300);
  assert.equal(speculationDelay(1000), 750);
  assert.equal(speculationDelay(400), 300);
});

test('no head start when the hold is too short for one', () => {
  assert.equal(speculationDelay(399), null);
  assert.equal(speculationDelay(100), null);
});
