// M4 · Puente entre el visor y una simulación aislada (iframe). Expone la MISMA interfaz que crearControlador,
// así los controles estándar funcionan igual para simulaciones integradas y aisladas.
import { validarParametros, validarArgsAccion } from '../contrato/manifiesto.js';
import { programadorReal, VELOCIDAD_MIN, VELOCIDAD_MAX } from '../nucleo/controlador.js';

export const CANAL = 'uniguajira-sim';
const ESTADOS_SIM = ['listo', 'reproduciendo', 'pausado'];
const entero = (n) => (Number.isInteger(n) && n >= 0 && n <= 1e6 ? n : 0);

/**
 * ventana: objeto con addEventListener/removeEventListener (window). destino: iframe.contentWindow.
 * El origen de un iframe sandbox sin allow-same-origin es "null"; se exige junto con ev.source === destino.
 */
export function crearPuente({ ventana, destino, manifiesto, origenEsperado = 'null', timeoutListoMs = 8000, programador = programadorReal() }) {
  let velocidadMs = 700, cache = null, tm = null, parametros = validarParametros(manifiesto, {}).valores;
  let st = { estado: 'cargando', indice: 0, total: 0, mensaje: '', aviso: null, error: null };
  const oyentes = new Set();
  const soporta = (c) => manifiesto.controles.includes(c);
  const emitir = () => { cache = null; oyentes.forEach((f) => f()); };
  const enviar = (m) => destino.postMessage({ canal: CANAL, version: 1, ...m }, '*'); // origen opaco: '*' es la única opción; solo viajan comandos

  function alMensaje(ev) {
    if (ev.source !== destino || ev.origin !== origenEsperado) return;
    const d = ev.data;
    if (!d || typeof d !== 'object' || d.canal !== CANAL || d.version !== 1) return;
    if (d.evento === 'listo') {
      if (tm !== null) { programador.cancelar(tm); tm = null; }
      st = { ...st, estado: 'listo', error: null };
      for (const [clave, valor] of Object.entries(parametros)) enviar({ cmd: 'parametro', clave, valor });
      emitir();
    } else if (d.evento === 'estado' && ESTADOS_SIM.includes(d.estado)) {
      st = { ...st, estado: d.estado, indice: entero(d.indice), total: entero(d.total), mensaje: typeof d.mensaje === 'string' ? d.mensaje.slice(0, 300) : '' };
      emitir();
    } else if (d.evento === 'error') {
      st = { ...st, estado: 'error', error: typeof d.mensaje === 'string' ? d.mensaje.slice(0, 300) : 'Error en la simulación' };
      emitir();
    }
  }
  ventana.addEventListener('message', alMensaje);

  const api = {
    /** Llamar en el onLoad del iframe: pide que la simulación se anuncie y arranca el temporizador de espera. */
    alCargar() {
      enviar({ cmd: 'hola' });
      if (tm !== null) programador.cancelar(tm);
      tm = programador.despues(() => { tm = null; if (st.estado === 'cargando') { st = { ...st, estado: 'error', error: 'La simulación no respondió. Puede que no use el SDK UniSim.' }; emitir(); } }, timeoutListoMs);
    },
    estado: () => (cache ??= Object.freeze({
      estado: st.estado, frame: null, indice: st.indice, total: st.total, pendiente: st.indice < st.total - 1, mensaje: st.mensaje,
      parametros: { ...parametros }, velocidadMs, controles: manifiesto.controles, aviso: st.aviso, error: st.error, puedeRetroceder: soporta('paso_atras'),
    })),
    suscribir: (fn) => { oyentes.add(fn); return () => oyentes.delete(fn); },
    iniciar() { if (soporta('iniciar')) enviar({ cmd: 'iniciar' }); },
    pausar() { if (soporta('pausar')) enviar({ cmd: 'pausar' }); },
    reiniciar() { st = { ...st, error: null, aviso: null }; emitir(); enviar({ cmd: 'reiniciar' }); },
    paso() { if (soporta('paso')) enviar({ cmd: 'paso' }); },
    pasoAtras() { if (soporta('paso_atras')) enviar({ cmd: 'paso_atras' }); },
    ejecutar(accion, args) {
      const v = validarArgsAccion(manifiesto, accion, args);
      if (!v.ok) { st = { ...st, aviso: v.error }; emitir(); return v; }
      enviar({ cmd: 'accion', accion, args: v.args }); return { ok: true };
    },
    setParametro(clave, valor) {
      if (!manifiesto.parametros.some((p) => p.clave === clave)) return { ok: false, error: 'Parámetro desconocido' };
      const r = validarParametros(manifiesto, { ...parametros, [clave]: valor });
      if (!r.ok) { st = { ...st, aviso: r.errores[0] }; emitir(); return { ok: false, error: r.errores[0] }; }
      parametros = r.valores; enviar({ cmd: 'parametro', clave, valor: parametros[clave] }); emitir(); return { ok: true };
    },
    setVelocidad(ms) { if (!soporta('velocidad')) return; velocidadMs = Math.min(VELOCIDAD_MAX, Math.max(VELOCIDAD_MIN, Math.round(Number(ms) || 700))); enviar({ cmd: 'velocidad', ms: velocidadMs }); emitir(); },
    exportarConfiguracion: () => ({ version: 1, parametros: { ...parametros }, velocidadMs, acciones: [] }),
    importarConfiguracion(cfg) {
      const p = validarParametros(manifiesto, cfg?.parametros ?? {});
      if (!p.ok) return { ok: false, errores: p.errores };
      for (const [k, v] of Object.entries(p.valores)) api.setParametro(k, v);
      return { ok: true, errores: [] };
    },
    dispose() { ventana.removeEventListener('message', alMensaje); if (tm !== null) programador.cancelar(tm); oyentes.clear(); },
  };
  return api;
}
