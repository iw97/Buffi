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
      iosClientId: '645457660698-l5663t838df4m0bcjrhaj6mhm02q22f4.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
