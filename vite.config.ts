import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { existsSync, readFileSync } from 'node:fs';
import pkg from './package.json' with { type: 'json' };

// Perfil personal opcional, fuera del repositorio (private/perfil.json, en .gitignore).
const perfilPath = new URL('./private/perfil.json', import.meta.url);
const perfil = process.env.PERFIL_PRIVADO === '1' && existsSync(perfilPath) ? readFileSync(perfilPath, 'utf8') : 'null';

// En la app iOS (Capacitor) no se usa service worker: build con CAPACITOR=1.
const native = process.env.CAPACITOR === '1';

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __PERFIL__: perfil },
  plugins: [
    react(),
    !native && VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Entreno',
        short_name: 'Entreno',
        description: 'Checks diarios, gimnasio, comidas y progreso. Datos solo en este dispositivo.',
        lang: 'es-AR',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f5f7f5',
        theme_color: '#1f7a44',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'], navigateFallback: 'index.html' },
    }),
  ],
  base: './',
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
});
