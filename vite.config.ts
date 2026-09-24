import { readFileSync } from 'node:fs';
import { configDefaults, defineConfig } from 'vitest/config';
import { serviceWorker } from './scripts/sw-plugin';
import { whatsNew } from './src/logic/whatsNew';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

export default defineConfig({
  base: './', // the same build runs from file:// in Electron and from the GitHub Pages subpath
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
    __WHATS_NEW__: JSON.stringify(whatsNew(readFileSync('CHANGELOG.md', 'utf8'))), // v0.7.1: the top CHANGELOG entry, for the What's new screen
  },
  plugins: [serviceWorker(pkg.version)],
  // agent worktrees live under .claude/; bot-driven tests play real runs, which a CI runner can take several seconds over
  test: { exclude: [...configDefaults.exclude, '.claude/**'], testTimeout: 20000 },
});
