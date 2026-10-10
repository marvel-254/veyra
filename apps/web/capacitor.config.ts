import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.veyra.app',
  appName: 'Veyra',
  // Next.js static export (`output: 'export'`) writes to out/ — bundled into the APK.
  webDir: 'out',
  android: {
    backgroundColor: '#0A0A0B',
    allowMixedContent: true,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
