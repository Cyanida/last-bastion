import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// v0.8.3 (#171): offline, the background update check (reg.update() on visibilitychange) used to reject with no
// .catch, which the app's window 'unhandledrejection' listener turns into the crash overlay. It should stay quiet,
// exactly like the initial registration a few lines above it.
describe('offline update check stays quiet (#171)', () => {
  let loadHandler: () => void;
  let visibilityHandler: () => void;
  let update: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('PROD', true);
    update = vi.fn().mockRejectedValue(new Error('offline'));
    const reg = { waiting: null, installing: null, addEventListener: vi.fn(), update };
    vi.stubGlobal('location', { protocol: 'https:' });
    vi.stubGlobal('window', {
      addEventListener: (name: string, fn: () => void) => {
        if (name === 'load') loadHandler = fn;
      },
    });
    vi.stubGlobal('document', {
      hidden: false,
      addEventListener: (name: string, fn: () => void) => {
        if (name === 'visibilitychange') visibilityHandler = fn;
      },
    });
    vi.stubGlobal('navigator', { serviceWorker: { register: vi.fn().mockResolvedValue(reg) } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('never leaves the failed reg.update() call unhandled', async () => {
    const { registerServiceWorker } = await import('../src/core/pwa');
    registerServiceWorker(() => undefined);
    loadHandler();
    await Promise.resolve(); // let register() resolve
    await Promise.resolve();

    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      visibilityHandler();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(update).toHaveBeenCalled();
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });
});
