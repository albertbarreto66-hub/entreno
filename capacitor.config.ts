import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Cambiá el appId por uno propio (ej. com.tunombre.entreno) si Xcode dice que ya está en uso.
  appId: 'ar.albert.entreno',
  appName: 'Entreno',
  webDir: 'dist',
  ios: { contentInset: 'never', limitsNavigationsToAppBoundDomains: false },
};

export default config;
