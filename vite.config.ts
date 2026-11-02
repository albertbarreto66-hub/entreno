import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { existsSync, readFileSync } from 'node:fs';
import pkg from './package.json' with { type: 'json' };
import { PROGRAM_SCHEDULE } from './src/data/schedule';
import { buildIcs } from './src/lib/ics';

// Perfil personal opcional, fuera del repositorio (private/perfil.json, en .gitignore).
const perfilPath = new URL('./private/perfil.json', import.meta.url);
const perfil = process.env.PERFIL_PRIVADO === '1' && existsSync(perfilPath) ? readFileSync(perfilPath, 'utf8') : 'null';

// En la app iOS (Capacitor) no se usa service worker: build con CAPACITOR=1.
const native = process.env.CAPACITOR === '1';

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __BUILD_TIME__: JSON.stringify(new Date().toISOString()), __PERFIL__: perfil },
  plugins: [
    react(),
    {
      // Recordatorios del horario del programa como archivos de Calendario (sin datos personales).
      name: 'recordatorios-ics',
      generateBundle() {
        const appUrl = process.env.APP_URL ?? '';
        for (const [fileName, water] of [['recordatorios.ics', true], ['recordatorios-sin-agua.ics', false]] as const) {
          this.emitFile({ type: 'asset', fileName, source: buildIcs(PROGRAM_SCHEDULE, { startDate: '2026-11-02', appUrl, water }) });
        }
      },
    },
    VitePWA({
      disable: native, // la app iOS no usa service worker
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'FORJA',
        short_name: 'FORJA',
        description: 'Checks diarios, gimnasio, comidas y progreso. Datos solo en este dispositivo.',
        lang: 'es-AR',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#0b0d10',
        theme_color: '#0b0d10',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'], navigateFallback: 'index.html', navigateFallbackDenylist: [/\.ics$/], skipWaiting: true, clientsClaim: true, cleanupOutdatedCaches: true },
    }),
  ],
  base: './',
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
});
