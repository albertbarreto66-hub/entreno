/** Comprime una imagen manteniendo proporciones (lado mayor ≤ maxSide). Nunca deforma. */
export async function compressImage(file: Blob, maxSide = 1600, quality = 0.82): Promise<{ blob: Blob; width: number; height: number; type: string }> {
  const bmp = await loadBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la imagen.');
  ctx.drawImage(bmp.source, 0, 0, w, h);
  bmp.close?.();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality));
  if (!blob) throw new Error('No se pudo comprimir la imagen.');
  return { blob, width: w, height: h, type: 'image/jpeg' };
}

async function loadBitmap(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close?: () => void }> {
  if ('createImageBitmap' in window) {
    try {
      const b = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      return { source: b, width: b.width, height: b.height, close: () => b.close() };
    } catch { /* fallback a <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    throw new Error('El archivo no parece ser una imagen compatible.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function isQuotaError(e: unknown) {
  return e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED');
}
