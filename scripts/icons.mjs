// Genera los PNG de ícono (PWA e iOS) y la pantalla de inicio iOS a partir de public/icon.svg usando Chromium.
import { chromium } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const svg = readFileSync(root + 'public/icon.svg', 'utf8');
const local = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const exe = process.env.CHROME_PATH || (existsSync(local) ? local : undefined);
const b = await chromium.launch(exe ? { executablePath: exe } : {});
async function shot(file, size, html) {
  const p = await b.newPage({ viewport: { width: size, height: size } });
  await p.setContent(`<html><body style="margin:0">${html}</body></html>`);
  await p.screenshot({ path: root + file });
  await p.close();
}
const icon = (s) => `<div style="background:#1f7a44;width:${s}px;height:${s}px">${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}</div>`;
for (const [f, s] of [['public/icon-192.png', 192], ['public/icon-512.png', 512], ['public/apple-touch-icon.png', 180]]) await shot(f, s, icon(s));
if (existsSync(root + 'ios/App/App/Assets.xcassets')) {
  await shot('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 1024, icon(1024));
  const splash = `<div style="width:2732px;height:2732px;background:#f5f7f5;display:grid;place-items:center">${svg.replace('<svg ', '<svg width="420" height="420" ')}</div>`;
  for (const n of ['', '-1', '-2']) await shot(`ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732${n}.png`, 2732, splash);
}
await b.close();
console.log('íconos generados');
