/// <reference types="@capacitor/push-notifications" />

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.admspot.finance',
  appName: 'AdmSpot Finance',
  webDir: 'www',
  plugins: {
    // Pedidos nativos (sem CORS do WebView). Opcional: `enabled: true` também faz patch do `fetch`.
    CapacitorHttp: {
      enabled: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
