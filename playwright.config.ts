import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const local = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const executablePath = process.env.CHROME_PATH || (existsSync(local) ? local : undefined);

export default defineConfig({
  testDir: 'e2e',
  timeout: 60000,
  workers: 1,
  reporter: [['list']],
  use: {
    ...devices['iPhone 13'],
    browserName: 'chromium',
    baseURL: 'http://localhost:4173',
    timezoneId: 'America/Argentina/Buenos_Aires',
    locale: 'es-AR',
    acceptDownloads: true,
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: { command: 'npm run build && npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 120000 },
});
