import { describe, expect, it } from 'vitest';
import { serviceWorker } from '../scripts/sw-plugin';

describe('Service worker install (v0.7.5)', () => {
  it('precaches every file with cache "reload", past the browser HTTP cache', async () => {
    let source = '';
    const plugin = serviceWorker('0.0.0') as unknown as { generateBundle: (this: unknown, o: unknown, b: object) => void };
    plugin.generateBundle.call({ emitFile: (f: { source: string }) => (source = f.source) }, {}, { 'assets/index.js': {} });

    // run the generated sw.js against stand-ins for the worker globals
    const listeners: Record<string, (e: unknown) => void> = {};
    const added: { url: string; cache: string }[] = [];
    const self = { addEventListener: (type: string, fn: (e: unknown) => void) => (listeners[type] = fn) };
    const caches = { open: async () => ({ addAll: async (reqs: { url: string; cache: string }[]) => void added.push(...reqs) }) };
    class Request {
      constructor(public url: string, init: { cache: string }) {
        this.cache = init.cache;
      }
      cache: string;
    }
    new Function('self', 'caches', 'Request', 'location', source)(self, caches, Request, { origin: 'x' });
    let done: Promise<unknown> = Promise.resolve();
    listeners.install({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;

    expect(added.map((r) => r.url)).toEqual(expect.arrayContaining(['./', './assets/index.js']));
    expect(added.every((r) => r.cache === 'reload')).toBe(true);
  });
});
