import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.buffi',
  appName: 'Buffi',
  webDir: 'public',
  server: {
    url: 'https://buffi.app/splash',
    cleartext: false,
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      // iOS CLIENT_ID from GoogleService-Info.plist
      iosClientId: 'REPLACE_WITH_IOS_CLIENT_ID',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
