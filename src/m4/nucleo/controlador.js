// M4 · Controlador estándar (RF-13). Traduce los controles estándar a la instancia de una simulación.
// Interfaz que debe cumplir una instancia (ver INFORME §3.2):
//   frameActual() · posicion() → {indice,total} · avanzar() → bool · retroceder() → bool
//   reiniciar() · ejecutar(accion,args) → {ok,error?} · ajustar(parametros)
import { validarParametros, validarArgsAccion } from '../contrato/manifiesto.js';

export const VELOCIDAD_MIN = 100;
export const VELOCIDAD_MAX = 3000;
const clamp = (n) => Math.min(VELOCIDAD_MAX, Math.max(VELOCIDAD_MIN, Math.round(Number(n) || 700)));

export function programadorReal() {
  return { despues: (fn, ms) => setTimeout(fn, ms), cancelar: (id) => clearTimeout(id) };
}

export function crearControlador(instancia, manifiesto, opciones = {}) {
  const prog = opciones.programador ?? programadorReal();
  const reproducirAlEjecutar = opciones.reproducirAlEjecutar ?? true;
  let velocidadMs = clamp(opciones.velocidadMs ?? 700);
  let parametros = validarParametros(manifiesto, {}).valores;
  let historial = [];
  let reproduciendo = false, temporizador = null, error = null, aviso = null, cache = null;
  const oyentes = new Set();
  const soporta = (c) => manifiesto.controles.includes(c);
  instancia.ajustar?.(parametros);

  const pendiente = () => { const p = instancia.posicion(); return p.indice < p.total - 1; };
  const construir = () => {
    const { indice, total } = instancia.posicion();
    const estado = error ? 'error' : reproduciendo ? 'reproduciendo' : indice < total - 1 ? 'pausado' : 'listo';
    return Object.freeze({
      estado, frame: instancia.frameActual(), indice, total, pendiente: indice < total - 1,
      parametros: { ...parametros }, velocidadMs, controles: manifiesto.controles, aviso, error,
      puedeRetroceder: soporta('paso_atras') && indice > 0,
    });
  };
  const emitir = () => { cache = null; oyentes.forEach((f) => f()); };
  const detener = () => { reproduciendo = false; if (temporizador !== null) { prog.cancelar(temporizador); temporizador = null; } };
  const seguro = (fn) => {
    try { fn(); } catch (e) { detener(); error = e?.message ?? 'Error en la simulación'; }
    emitir();
  };
  const programar = () => { temporizador = prog.despues(tick, velocidadMs); };
  function tick() {
    temporizador = null;
    if (!reproduciendo) return;
    seguro(() => { instancia.avanzar(); if (pendiente()) programar(); else reproduciendo = false; });
  }
  const bloqueado = () => error !== null;

  const api = {
    estado: () => (cache ??= construir()),
    suscribir: (fn) => { oyentes.add(fn); return () => oyentes.delete(fn); },
    iniciar() {
      if (bloqueado() || !soporta('iniciar') || reproduciendo || !pendiente()) return;
      reproduciendo = true; aviso = null; seguro(programar);
    },
    pausar() { if (!soporta('pausar')) return; detener(); emitir(); },
    reiniciar() { seguro(() => { detener(); error = null; aviso = null; historial = []; instancia.reiniciar(); }); },
    paso() { if (bloqueado() || !soporta('paso')) return; seguro(() => { detener(); aviso = null; instancia.avanzar(); }); },
    pasoAtras() { if (bloqueado() || !soporta('paso_atras')) return; seguro(() => { detener(); instancia.retroceder(); }); },
    ejecutar(accion, args) {
      if (bloqueado()) return { ok: false, error: 'La simulación está en error; reiníciela' };
      const v = validarArgsAccion(manifiesto, accion, args);
      if (!v.ok) { aviso = v.error; emitir(); return v; }
      let res = { ok: true };
      seguro(() => {
        detener(); aviso = null;
        res = instancia.ejecutar(accion, v.args);
        if (res.ok) historial.push({ accion, args: v.args }); else aviso = res.error ?? 'No se pudo ejecutar la acción';
      });
      if (res.ok && reproducirAlEjecutar && soporta('iniciar') && !bloqueado() && pendiente()) api.iniciar();
      return res;
    },
    setParametro(clave, valor) {
      const def = manifiesto.parametros.find((p) => p.clave === clave);
      if (!def) return { ok: false, error: 'Parámetro desconocido' };
      const { ok, valores, errores } = validarParametros(manifiesto, { ...parametros, [clave]: valor });
      if (!ok) { aviso = errores[0]; emitir(); return { ok: false, error: errores[0] }; }
      parametros = valores; seguro(() => instancia.ajustar?.(parametros));
      return { ok: true };
    },
    setVelocidad(ms) { if (!soporta('velocidad')) return; velocidadMs = clamp(ms); emitir(); },
    /** RF-15: configuración serializable (parámetros + acciones ejecutadas). */
    exportarConfiguracion: () => ({ version: 1, parametros: { ...parametros }, velocidadMs, acciones: historial.map((h) => ({ ...h })) }),
    /** Valida TODO antes de aplicar; la configuración viene de la BD/otro usuario y no es de confianza. */
    importarConfiguracion(cfg) {
      if (!cfg || typeof cfg !== 'object' || cfg.version !== 1) return { ok: false, errores: ['Configuración no válida'] };
      const p = validarParametros(manifiesto, cfg.parametros ?? {});
      if (!p.ok) return { ok: false, errores: p.errores };
      const acc = Array.isArray(cfg.acciones) ? cfg.acciones : [];
      if (acc.length > 200) return { ok: false, errores: ['Demasiadas acciones (máx. 200)'] };
      const lim = [];
      for (const a of acc) { const v = validarArgsAccion(manifiesto, a?.accion, a?.args); if (!v.ok) return { ok: false, errores: [v.error] }; lim.push({ accion: a.accion, args: v.args }); }
      seguro(() => {
        detener(); error = null; aviso = null; instancia.reiniciar(); historial = [];
        parametros = p.valores; instancia.ajustar?.(parametros);
        if (cfg.velocidadMs !== undefined) velocidadMs = clamp(cfg.velocidadMs);
        for (const a of lim) { const r = instancia.ejecutar(a.accion, a.args); if (!r.ok) throw new Error(r.error); historial.push(a); while (instancia.avanzar()); }
      });
      return { ok: !error, errores: error ? [error] : [] };
    },
    dispose() { detener(); oyentes.clear(); },
  };
  return api;
}
