import { createHash } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';

/** Every file under public/, as URLs relative to the site root. */
function publicFiles(dir = 'public'): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? publicFiles(path) : [relative('public', path).replace(/\\/g, '/')];
  });
}

/**
 * Emits sw.js with the exact list of built files, so the whole game is precached and works offline.
 * The worker never calls skipWaiting on its own: a new version waits until the page (title screen) asks for it,
 * so a deploy can never swap code under a run in progress.
 */
export function serviceWorker(version: string): Plugin {
  return {
    name: 'last-bastion-sw',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = ['./', ...Object.keys(bundle), ...publicFiles()].filter((f) => f !== 'sw.js').map((f) => (f === './' ? f : `./${f}`));
      const hash = createHash('sha1').update(files.join('|')).digest('hex').slice(0, 8);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: SW.replace('__CACHE__', `lb-${version}-${hash}`).replace('__FILES__', JSON.stringify(files)) });
    },
  };
}

const SW = `const CACHE = '__CACHE__';
const FILES = __FILES__;
const FONTS = 'fonts-lb';

// cache: 'reload' skips the HTTP cache (Pages sets max-age=600), so two quick deploys can't pair an old index.html with new files
self.addEventListener('install', (e) =>
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))),
);

self.addEventListener('activate', (e) =>
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('lb-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).catch(() => caches.match('./'))), // offline navigation falls back to the cached page
    );
  } else if (/fonts\\.(googleapis|gstatic)\\.com$/.test(url.hostname)) {
    // fonts: serve from cache, refresh in the background
    e.respondWith(
      caches.open(FONTS).then((c) =>
        c.match(e.request).then((hit) => {
          const net = fetch(e.request).then((res) => (c.put(e.request, res.clone()), res)).catch(() => hit);
          return hit || net;
        }),
      ),
    );
  }
});
`;
