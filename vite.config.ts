import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { serviceWorker } from './scripts/sw-plugin';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

export default defineConfig({
  base: './', // the same build runs from file:// in Electron and from the GitHub Pages subpath
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [serviceWorker(pkg.version)],
});
