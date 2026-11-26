// Minimal Chrome DevTools Protocol client over Node's built-in WebSocket, so the e2e suite needs no npm packages.

export class Cdp {
  #ws;
  #nextId = 1;
  #pending = new Map();
  #listeners = new Set();

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    return new Cdp(ws);
  }

  constructor(ws) {
    this.#ws = ws;
    ws.addEventListener('message', (event) => this.#onMessage(JSON.parse(event.data)));
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
      this.#ws.send(JSON.stringify(payload));
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
    this.#ws.close();
  }
}
