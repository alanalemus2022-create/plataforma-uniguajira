// M4 · Prepara el HTML de una simulación de usuario para ejecutarla aislada (RF-19, RNF-02).
// Capas: (1) iframe con sandbox="allow-scripts" SIN allow-same-origin → origen opaco: sin cookies, sin localStorage,
// sin acceso al DOM ni al token de Supabase de la página; (2) CSP que bloquea red y recursos externos;
// (3) mensajes validados en el puente.
import { SDK_FUENTE } from './sdk-fuente.js';

export const ATRIBUTOS_SANDBOX = 'allow-scripts';
export const MAX_BYTES_HTML = 2 * 1024 * 1024;
export const CSP = [
  "default-src 'none'", "script-src 'unsafe-inline'", "style-src 'unsafe-inline'", 'img-src data: blob:',
  'font-src data:', 'media-src data: blob:', 'worker-src blob:', "connect-src 'none'", "frame-src 'none'",
  "form-action 'none'", "base-uri 'none'",
].join('; ');

export function prepararDocumentoAislado(htmlUsuario) {
  if (typeof htmlUsuario !== 'string') throw new Error('El contenido de la simulación debe ser texto HTML');
  if (new TextEncoder().encode(htmlUsuario).length > MAX_BYTES_HTML) throw new Error('La simulación supera 2 MB');
  // La meta CSP va primero para que rija todo lo que sigue; después el SDK; después el contenido del autor.
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1"><script>${SDK_FUENTE}</script></head><body>${htmlUsuario}</body></html>`;
}

/** Solo se descargan simulaciones aisladas desde orígenes https de una lista blanca (p. ej. Supabase Storage). */
export async function descargarHtmlAislado(url, { origenesPermitidos, fetchFn = globalThis.fetch }) {
  let u;
  try { u = new URL(url); } catch { throw new Error('URL de simulación no válida'); }
  if (u.protocol !== 'https:' || !origenesPermitidos.includes(u.origin)) throw new Error('Origen de la simulación no permitido');
  const r = await fetchFn(u.href, { credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer' });
  if (!r.ok) throw new Error(`No se pudo cargar la simulación (${r.status})`);
  const t = await r.text();
  if (t.length > MAX_BYTES_HTML) throw new Error('La simulación supera 2 MB');
  return t;
}
