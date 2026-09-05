import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.boardarena.app',
  appName: 'Board Arena',
  webDir: 'dist/mobile',
  backgroundColor: '#0c1018',
  server: { androidScheme: 'https' },
  android: { allowMixedContent: false },
  ios: { contentInset: 'automatic' },
};
export default config;
