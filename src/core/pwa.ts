/**
 * Registers the service worker (production web builds only: not in dev, not under file:// in Electron).
 * A new deploy installs in the background and then waits. `onUpdate` receives a function that activates it and
 * reloads; the title screen offers that as "new version available", so an update never lands mid-run.
 */
export function registerServiceWorker(onUpdate: (apply: () => void) => void): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        const offer = (): void => {
          const waiting = reg.waiting;
          if (!waiting || !navigator.serviceWorker.controller) return; // first install: nothing to update from
          onUpdate(() => {
            navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
            waiting.postMessage('skipWaiting');
          });
        };
        offer();
        reg.addEventListener('updatefound', () => reg.installing?.addEventListener('statechange', offer));
        // a home-screen app can stay open for days: look for a new deploy whenever it comes back to the foreground
        document.addEventListener('visibilitychange', () => !document.hidden && void reg.update());
      })
      .catch(() => undefined); // offline support is a bonus, never a reason to fail
  });
}
