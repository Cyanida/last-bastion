import { isTouchDevice } from '../input';

/** What the Electron preload exposes (electron/preload.cjs). Absent in a browser. */
export interface DesktopApi {
  getVersion(): Promise<string>;
  checkForUpdates(allowPrerelease?: boolean): Promise<void>;
  quitAndInstall(): void;
  onUpdateStatus(fn: (s: UpdateStatus) => void): void;
}
export type UpdateStatus =
  | { state: 'checking' | 'none' }
  | { state: 'available' | 'ready'; version: string }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'error'; message: string };

declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}
declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;

export const platform = {
  desktop: typeof window !== 'undefined' ? window.desktop : undefined,
  touch: isTouchDevice(),
  version: __APP_VERSION__,
  buildDate: __BUILD_DATE__,
  get name(): 'Desktop' | 'Web' {
    return this.desktop ? 'Desktop' : 'Web';
  },
};
