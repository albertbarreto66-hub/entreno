import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const errors: string[] = [];
function watchConsole(page: Page) {
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
}
async function fresh(page: Page) {
  watchConsole(page);
  await page.goto('/#/hoy');
  await page.getByRole('button', { name: 'Empezar', exact: true }).click(); // bienvenida: meta 15.000
  await expect(page.getByText('Meta de pasos para la semana 1')).toBeHidden();
}
async function noHorizontalScroll(page: Page) {
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(sw).toBeLessThanOrEqual(iw);
}

test.afterAll(() => { expect(errors, errors.join('\n')).toEqual([]); });

test('1. registrar una serie y recuperarla al recargar', async ({ page }) => {
  await fresh(page);
  await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Entrenar' }).click();
  await page.getByRole('combobox', { name: 'Sesión' }).selectOption('lunes');
  await page.getByRole('button', { name: 'Empezar sesión' }).click();
  await page.getByLabel('Serie 1 kg').first().fill('42,5');
  await page.getByLabel('Serie 1 repeticiones', { exact: true }).first().fill('8');
  await page.getByLabel('Serie 1 repeticiones en reserva').first().selectOption('2');
  await page.getByRole('button', { name: 'Serie 1 marcar hecha' }).first().click();
  await expect(page.getByRole('timer')).toBeVisible();
  // calentamiento separado
  await page.getByRole('button', { name: '+ Serie de calentamiento' }).first().click();
  await page.getByLabel('Calentamiento 1 kg').fill('20');
  await page.getByLabel('Calentamiento 1 repeticiones').fill('10');
  await page.getByLabel('Calentamiento 1 repeticiones').blur();
  await page.reload();
  await expect(page.getByLabel('Serie 1 kg').first()).toHaveValue('42,5');
  await expect(page.getByLabel('Serie 1 repeticiones', { exact: true }).first()).toHaveValue('8');
  await expect(page.getByRole('button', { name: 'Serie 1 hecha' }).first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Calentamiento 1 kg')).toHaveValue('20');
  await expect(page.getByText('1/2').first()).toBeVisible(); // calentamiento no cuenta
  await expect(page.getByRole('timer')).toBeVisible(); // el temporizador sobrevive a la recarga
  await page.getByRole('button', { name: 'Terminar sesión' }).click();
  await page.getByRole('button', { name: 'Guardar como incompleta' }).click();
  await expect(page.getByText('Incompleta').first()).toBeVisible();
  await noHorizontalScroll(page);
});

test('2. completar y editar una comida; desmarcar pide confirmación', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: /Desayuno registrado/ }).click();
  await page.getByRole('button', { name: 'Comí esto' }).click();
  await expect(page.getByRole('button', { name: /Desayuno registrado/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Comidas' }).click();
  const card = page.locator('section.card', { has: page.getByRole('heading', { name: 'Desayuno' }) });
  await card.getByRole('button', { name: 'Editar' }).click();
  const dialog = page.getByRole('dialog', { name: 'Editar comida' });
  const firstGrams = dialog.locator('input.grams').first();
  await firstGrams.fill('150');
  await firstGrams.blur();
  await dialog.getByRole('textbox', { name: 'Nombre' }).fill('Desayuno editado');
  await dialog.getByRole('button', { name: 'Guardar comida' }).click();
  await expect(card.getByText('Desayuno editado')).toBeVisible();
  await expect(card.getByText(/150 g/)).toBeVisible();
  // Desmarcar desde Hoy: "Mantener" no borra
  await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Hoy' }).click();
  await page.getByRole('button', { name: /Desayuno registrado/ }).click();
  await page.getByRole('button', { name: 'Mantener' }).click();
  await expect(page.getByRole('button', { name: /Desayuno registrado/ })).toHaveAttribute('aria-pressed', 'true');
  // Texto libre: sin estimación inventada
  await page.getByRole('button', { name: /Cena registrada/ }).click();
  await page.getByRole('button', { name: 'Registrar otra comida' }).click();
  await page.getByRole('radio', { name: 'Texto libre' }).click();
  await page.getByLabel('¿Qué comiste?').fill('Dos empanadas de carne');
  await page.getByRole('button', { name: 'Guardar comida' }).click();
  await expect(page.getByText('sin estimación')).toBeVisible();
});

test('3 y 4. pasos y líquidos sin duplicar; cambiar de día sin mezclar', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: 'Agua' }).click();
  const water = page.getByRole('dialog', { name: 'Líquidos' });
  await water.getByRole('button', { name: '+250 ml' }).click();
  await water.getByRole('button', { name: '+500 ml' }).click();
  await expect(water.getByText('750 ml')).toBeVisible();
  await expect(water.locator('ul.list li')).toHaveCount(2);
  await water.getByRole('button', { name: 'Cerrar' }).click();

  await page.getByRole('button', { name: 'Pasos' }).first().click();
  let steps = page.getByRole('dialog', { name: 'Pasos' });
  await steps.getByLabel(/Registrar pasos/).fill('9000');
  await steps.getByRole('button', { name: 'Guardar' }).click();
  await page.getByRole('button', { name: 'Pasos' }).first().click();
  steps = page.getByRole('dialog', { name: 'Pasos' });
  await steps.getByLabel(/Registrar pasos/).fill('7000');
  await steps.getByRole('button', { name: 'Guardar' }).click();
  await page.getByRole('button', { name: /Sumar/ }).click();
  await expect(page.getByRole('button', { name: /Meta de pasos alcanzada/ })).toContainText('16.000 / 15.000');
  await expect(page.getByRole('button', { name: /Meta de pasos alcanzada/ })).toHaveAttribute('aria-pressed', 'true');

  // Día anterior
  await page.getByRole('button', { name: 'Día anterior' }).click();
  await expect(page.getByText(/Estás viendo y editando/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Líquidos registrados/ })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: /Meta de pasos/ })).toContainText('Sin datos disponibles');
  await page.getByRole('button', { name: 'Agua' }).click();
  await page.getByRole('dialog', { name: 'Líquidos' }).getByRole('button', { name: '+500 ml' }).click();
  await page.getByRole('dialog', { name: 'Líquidos' }).getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByRole('button', { name: /Líquidos registrados/ })).toContainText('500 ml');
  await page.getByRole('button', { name: 'Volver a hoy' }).click();
  await expect(page.getByRole('button', { name: /Líquidos registrados/ })).toContainText('750 ml');
  await page.reload();
  await expect(page.getByRole('button', { name: /Líquidos registrados/ })).toContainText('750 ml');
});

test('5 y 6. guardar y comparar dos fotos; exportar y restaurar respaldo con fotos', async ({ page }, info) => {
  await fresh(page);
  await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Progreso' }).click();
  await page.getByRole('radio', { name: 'Fotos' }).click();
  for (const [file, date] of [['icon-512.png', '2026-10-12'], ['icon-192.png', '2026-10-19']]) {
    await page.getByRole('button', { name: '+ Agregar foto' }).click();
    const d = page.getByRole('dialog', { name: 'Agregar foto' });
    await d.getByLabel('Fecha').fill(date);
    await d.getByTestId('photo-gallery').setInputFiles(path.join('public', file));
    await expect(d).toBeHidden();
  }
  await expect(page.locator('.thumb')).toHaveCount(2);
  await expect(page.locator('.side img')).toHaveCount(2);
  await page.getByRole('radio', { name: 'Deslizador' }).click();
  await page.getByLabel('Deslizador de comparación').fill('30');
  await expect(page.getByTestId('slider-frame').locator('img').nth(1)).toHaveAttribute('style', /inset\(0px 0px 0px 30%\)|inset\(0 0 0 30%\)/);
  // proporciones: object-fit contain
  expect(await page.getByTestId('slider-frame').locator('img').first().evaluate((e) => getComputedStyle(e).objectFit)).toBe('contain');

  // Exportar
  await page.getByRole('button', { name: 'Perfil y ajustes' }).click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Exportar respaldo completo/ }).click()]);
  const zipPath = info.outputPath('respaldo.zip');
  await dl.saveAs(zipPath);
  expect(dl.suggestedFilename()).toMatch(/^respaldo-entreno-.*\.zip$/);

  // Borrar fotos y restaurar
  await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Progreso' }).click();
  await page.getByRole('radio', { name: 'Fotos' }).click();
  await page.locator('.thumb').first().click();
  await page.getByRole('button', { name: 'Borrar' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Borrar' }).click();
  await expect(page.locator('.thumb')).toHaveCount(1);

  await page.getByRole('button', { name: 'Perfil y ajustes' }).click();
  await page.getByTestId('restore-input').setInputFiles(zipPath);
  await expect(page.getByText('Vista previa del respaldo')).toBeVisible();
  await expect(page.getByRole('row', { name: /Fotos/ })).toContainText('2');
  await page.getByRole('button', { name: 'Reemplazar mis datos con este respaldo' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reemplazar datos' }).click();
  await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Progreso' }).click();
  await page.getByRole('radio', { name: 'Fotos' }).click();
  await expect(page.locator('.thumb')).toHaveCount(2);
  await expect(page.locator('.thumb img').first()).toHaveJSProperty('complete', true);
  expect(await page.locator('.thumb img').first().evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
});

test('7. editar metas sin cambiar el historial', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: 'Día anterior' }).click();
  await page.getByRole('button', { name: 'Pasos' }).first().click();
  await page.getByRole('dialog', { name: 'Pasos' }).getByLabel(/Registrar pasos/).fill('15200');
  await page.getByRole('dialog', { name: 'Pasos' }).getByRole('button', { name: 'Guardar' }).click();
  await page.getByRole('button', { name: 'Volver a hoy' }).click();
  await page.getByRole('button', { name: 'Perfil y ajustes' }).click();
  const row = page.locator('.goalrow').first();
  await row.getByPlaceholder('Nuevo valor').fill('16000');
  await row.getByRole('button', { name: 'Aplicar' }).click();
  await expect(row).toContainText('actual: 16.000');
  await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Hoy' }).click();
  await page.getByRole('button', { name: 'Día anterior' }).click();
  await expect(page.getByRole('button', { name: /Meta de pasos alcanzada/ })).toContainText('15.200 / 15.000');
  await expect(page.getByRole('button', { name: /Meta de pasos alcanzada/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Volver a hoy' }).click();
  await page.getByRole('button', { name: 'Pasos' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Pasos' })).toContainText('Meta del día: 16.000');
});

test('8 y 9. todas las pantallas en móvil, sin scroll horizontal ni errores', async ({ page }) => {
  await fresh(page);
  for (const r of ['hoy', 'entrenar', 'comidas', 'progreso', 'ajustes']) {
    await page.goto(`/#/${r}`);
    await page.waitForTimeout(300);
    await noHorizontalScroll(page);
  }
  await page.goto('/#/comidas');
  for (const t of ['Menú', 'Compras', 'Preparación']) { await page.getByRole('radio', { name: t }).click(); await noHorizontalScroll(page); }
  await page.goto('/#/ajustes');
  await expect(page.getByText(/requiere la versión iOS|En el navegador no hay acceso a Salud/).first()).toBeVisible();
  await expect(page.getByText(/Los datos locales pueden perderse/)).toBeVisible();
});

test('PWA: funciona sin conexión después de la primera carga', async ({ page, context }) => {
  await fresh(page);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload(); // la segunda carga ya queda controlada por el service worker
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Checks del día' })).toBeVisible();
  await page.getByRole('button', { name: 'Agua' }).click();
  await page.getByRole('dialog', { name: 'Líquidos' }).getByRole('button', { name: '+250 ml' }).click();
  await expect(page.getByRole('dialog', { name: 'Líquidos' }).getByText('250 ml').first()).toBeVisible();
  await context.setOffline(false);
});
