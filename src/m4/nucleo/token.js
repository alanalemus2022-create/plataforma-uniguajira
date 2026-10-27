// M4 · Token aleatorio del navegador para registrar_vista (M6). Sin datos personales; M6 guarda solo su hash.
const CLAVE = 'uniguajira_vid';
let enMemoria = null;
export function obtenerTokenVisitante(almacen = globalThis.localStorage, cripto = globalThis.crypto) {
  try { const t = almacen?.getItem(CLAVE); if (t && t.length >= 16 && t.length <= 128) return t; } catch { /* almacenamiento bloqueado */ }
  enMemoria ??= (cripto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);
  try { almacen?.setItem(CLAVE, enMemoria); } catch { /* se usa solo en memoria */ }
  return enMemoria;
}
export const _reiniciarParaPruebas = () => { enMemoria = null; };
