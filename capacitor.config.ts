import type { CapacitorConfig } from '@capacitor/cli';

// Wraps the same dist/ build as a native iOS app. Building needs a Mac with Xcode: see README "Native iOS build".
const config: CapacitorConfig = {
  appId: 'io.github.cyanida.lastbastion',
  appName: 'Last Bastion',
  webDir: 'dist',
  ios: { contentInset: 'never', backgroundColor: '#14110f' },
};

export default config;
