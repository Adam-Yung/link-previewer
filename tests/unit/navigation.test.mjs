import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadScripts } from '../helpers/sandbox.mjs';

const { isSameDocument } = loadScripts(['Common/components/ui.js'], ['isSameDocument']);

test('a fragment-only change stays in the same document', () => {
  assert.equal(isSameDocument('https://a.test/doc?x=1#top', 'https://a.test/doc?x=1#part-2'), true);
});

test('a different query is a different document (a new search, a new page of results)', () => {
  assert.equal(isSameDocument('https://a.test/search?q=one', 'https://a.test/search?q=two'), false);
});

test('unparseable URLs are never the same document', () => {
  assert.equal(isSameDocument('not a url', 'not a url'), false);
});
