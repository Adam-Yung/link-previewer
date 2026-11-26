// Minimal Chrome DevTools Protocol client over Chrome's --remote-debugging-pipe, so the e2e suite needs no npm packages. The pipe
// (rather than a debugging port) is what makes Extensions.loadUnpacked available.

export class Cdp {
  #out;
  #buffer = '';
  #nextId = 1;
  #pending = new Map();
  #listeners = new Set();

  // out: Chrome's fd 3 (commands in), input: its fd 4 (replies and events out); messages are NUL-terminated JSON.
  constructor(out, input) {
    this.#out = out;
    input.setEncoding('utf8');
    input.on('data', (chunk) => {
      this.#buffer += chunk;
      let end;
      while ((end = this.#buffer.indexOf('\0')) >= 0) {
        const text = this.#buffer.slice(0, end);
        this.#buffer = this.#buffer.slice(end + 1);
        this.#onMessage(JSON.parse(text));
      }
    });
  }

  #onMessage(msg) {
    if (msg.id === undefined) {
      for (const listener of this.#listeners) listener(msg);
      return;
    }
    const pending = this.#pending.get(msg.id);
    if (!pending) return;
    this.#pending.delete(msg.id);
    if (msg.error) pending.reject(new Error(`${pending.method}: ${msg.error.message}`));
    else pending.resolve(msg.result);
  }

  send(method, params = {}, sessionId = undefined) {
    const id = this.#nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject, method });
      this.#out.write(`${JSON.stringify(payload)}\0`);
    });
  }

  onEvent(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  // Resolves with the first event matching method (and predicate) within timeoutMs.
  waitFor(method, predicate = () => true, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error(`timed out waiting for ${method}`));
      }, timeoutMs);
      const off = this.onEvent((msg) => {
        if (msg.method !== method || !predicate(msg)) return;
        clearTimeout(timer);
        off();
        resolve(msg);
      });
    });
  }

  close() {
    this.#out.end();
  }
}
