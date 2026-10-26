import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dizo.watchlab',
  appName: 'DIZO Watch Lab',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
