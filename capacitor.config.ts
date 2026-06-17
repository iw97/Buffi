import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.buffi',
  appName: 'Buffi',
  webDir: 'public',
  server: {
    url: 'https://buffi.app',
    cleartext: false,
  },
};

export default config;
