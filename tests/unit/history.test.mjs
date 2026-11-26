import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadScripts } from '../helpers/sandbox.mjs';

function fakeButton() {
  const handlers = {};
  const classes = new Set();
  return {
    disabled: false, title: '',
    addEventListener: (type, fn) => { handlers[type] = fn; },
    click: () => handlers.click?.(),
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
  };
}

function make(initial = 'https://a.test/1') {
  class Node {}
  const root = Object.assign(new Node(), {
    buttons: { 'link-preview-back': fakeButton(), 'link-preview-forward': fakeButton(), 'link-preview-copy': fakeButton() },
    getElementById(id) { return this.buttons[id]; },
  });
  const { HistoryManager } = loadScripts(['Common/components/history.js'], ['HistoryManager'], {
    Node, navigator: { clipboard: { writeText: async () => {} } },
  });
  const visits = [];
  const history = new HistoryManager(root, initial, (url) => visits.push(url));
  return { history, visits, back: root.buttons['link-preview-back'], forward: root.buttons['link-preview-forward'] };
}

test('back and forward walk the entries and toggle the buttons', () => {
  const { history, visits, back, forward } = make();
  assert.equal(back.disabled, true);
  history.addNewEntry('https://a.test/2');
  history.addNewEntry('https://a.test/3');
  back.click();
  back.click();
  assert.deepEqual(visits, ['https://a.test/2', 'https://a.test/1']);
  assert.equal(back.disabled, true);
  forward.click();
  assert.equal(history.getCurrentUrl(), 'https://a.test/2');
});

test('a new entry after going back drops the forward entries', () => {
  const { history, back, forward } = make();
  history.addNewEntry('https://a.test/2');
  back.click();
  history.addNewEntry('https://a.test/other');
  assert.equal(forward.disabled, true);
  back.click();
  assert.equal(history.getCurrentUrl(), 'https://a.test/1');
});

test('history keeps the newest 50 entries', () => {
  const { history } = make('https://a.test/0');
  for (let i = 1; i <= 60; i++) history.addNewEntry(`https://a.test/${i}`);
  assert.equal(history.getCurrentUrl(), 'https://a.test/60');
});

test('re-adding the current url is ignored', () => {
  const { history, back } = make();
  history.addNewEntry('https://a.test/1');
  assert.equal(back.disabled, true);
});
