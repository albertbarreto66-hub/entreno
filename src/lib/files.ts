import { Capacitor } from '@capacitor/core';

/**
 * Entrega un archivo al usuario. En navegador: descarga. En la app iOS: lo guarda en
 * Documentos de la app y abre la hoja de compartir (para guardarlo en Archivos, AirDrop, etc.).
 */
export async function saveFile(blob: Blob, name: string): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const data = await blobToBase64(blob);
    const r = await Filesystem.writeFile({ path: name, data, directory: Directory.Documents });
    try { await Share.share({ title: name, url: r.uri }); } catch { /* el usuario cerró la hoja */ }
    return `Guardado en Archivos › En mi iPhone › (esta app) › ${name}`;
  }
  // Dentro de claude.ai las descargas directas están bloqueadas: se usa su capacidad "downloads".
  const host = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
  if (host?.use) {
    const downloads = (await host.use('downloads').catch(() => null)) as { save: (r: { filename: string; data: Blob }) => Promise<{ status: string }> } | null;
    if (downloads) {
      try {
        await downloads.save({ filename: name, data: blob });
        return `Guardado: ${name}`;
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === 'declined') throw new Error('Cancelaste la descarga.');
        if (code !== 'unavailable' && code !== 'not_granted') throw new Error((e as { message?: string }).message ?? 'No se pudo guardar el archivo.');
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return `Descargado: ${name}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] ?? '');
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}
