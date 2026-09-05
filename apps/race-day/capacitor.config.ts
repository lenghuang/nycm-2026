import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lenhuang.nycmraceday',
  appName: 'NYC Race Day',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      presentationOptions: ['sound', 'banner', 'list'],
    },
  },
};

export default config;
