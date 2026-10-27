// M4 · Contrato común de simulación (v1). Sin dependencias; funciona en navegador y en Node.
export const CONTRATO_VERSION = 1;
export const TIPOS = ['visualizador', 'simulador', 'ejercicio', 'otro'];
export const RUNTIMES = ['integrada', 'aislada'];
export const CONTROLES = ['iniciar', 'pausar', 'reiniciar', 'paso', 'paso_atras', 'velocidad'];
export const VISTAS_INTEGRADAS = ['arbol'];
export const TIPOS_CAMPO = ['entero', 'decimal', 'booleano', 'opcion'];

const RE_CLAVE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RE_ID = /^[a-z][a-z0-9_]{0,29}$/;
const RE_ENTRADA_INTEGRADA = /^[a-z0-9-]{3,60}$/;
const RE_ENTRADA_AISLADA = /^https:\/\/\S{1,480}$/;
const texto = (x, max) => typeof x === 'string' && x.trim().length > 0 && x.length <= max;

/** Valida y normaliza un valor contra la definición de un campo (parámetro o campo de acción). */
export function normalizarCampo(def, valor) {
  switch (def.tipo) {
    case 'entero':
    case 'decimal': {
      const n = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
      const ok = def.tipo === 'entero' ? Number.isInteger(n) : Number.isFinite(n);
      if (!ok) return { ok: false, error: `${def.etiqueta} debe ser un número ${def.tipo === 'entero' ? 'entero' : ''}`.trim() };
      if (n < def.min || n > def.max) return { ok: false, error: `${def.etiqueta} debe estar entre ${def.min} y ${def.max}` };
      return { ok: true, valor: n };
    }
    case 'booleano':
      return typeof valor === 'boolean' ? { ok: true, valor } : { ok: false, error: `${def.etiqueta} debe ser verdadero o falso` };
    case 'opcion':
      return def.opciones.includes(valor) ? { ok: true, valor } : { ok: false, error: `${def.etiqueta}: opción no válida` };
    default:
      return { ok: false, error: 'Tipo de campo desconocido' };
  }
}

function validarCampoDef(c, ruta, errores, conDefecto) {
  if (!c || typeof c !== 'object') return errores.push(`${ruta}: debe ser un objeto`);
  const antes = errores.length;
  if (!RE_ID.test(c.clave ?? '')) errores.push(`${ruta}.clave inválida (a-z, 0-9, _; empieza con letra; máx. 30)`);
  if (!texto(c.etiqueta, 60)) errores.push(`${ruta}.etiqueta obligatoria (máx. 60 caracteres)`);
  if (!TIPOS_CAMPO.includes(c.tipo)) return errores.push(`${ruta}.tipo debe ser uno de: ${TIPOS_CAMPO.join(', ')}`);
  if (c.tipo === 'entero' || c.tipo === 'decimal') {
    if (!Number.isFinite(c.min) || !Number.isFinite(c.max) || c.min > c.max) errores.push(`${ruta}: min y max deben ser numéricos con min <= max`);
    else if (c.tipo === 'entero' && (!Number.isInteger(c.min) || !Number.isInteger(c.max))) errores.push(`${ruta}: min y max deben ser enteros`);
  }
  if (c.tipo === 'opcion' && (!Array.isArray(c.opciones) || c.opciones.length < 2 || c.opciones.length > 20 || !c.opciones.every((o) => texto(o, 40))))
    errores.push(`${ruta}.opciones debe tener de 2 a 20 textos`);
  if (conDefecto && errores.length === antes) {
    const r = normalizarCampo(c, c.defecto);
    if (!r.ok) errores.push(`${ruta}.defecto: ${r.error}`);
  }
}

function lista(m, campo, max, errores, validarItem) {
  const arr = m[campo];
  if (!Array.isArray(arr) || arr.length > max) return errores.push(`${campo} debe ser una lista de máximo ${max} elementos`);
  const vistas = new Set();
  arr.forEach((it, i) => {
    validarItem(it, `${campo}[${i}]`);
    if (it && vistas.has(it.clave)) errores.push(`${campo}[${i}].clave repetida`);
    vistas.add(it?.clave);
  });
}

/** Valida un manifiesto completo. Devuelve { ok, errores }. */
export function validarManifiesto(m) {
  const e = [];
  if (!m || typeof m !== 'object' || Array.isArray(m)) return { ok: false, errores: ['El manifiesto debe ser un objeto'] };
  if (m.contrato !== CONTRATO_VERSION) e.push(`contrato debe ser ${CONTRATO_VERSION}`);
  if (typeof m.clave !== 'string' || !RE_CLAVE.test(m.clave) || m.clave.length < 3 || m.clave.length > 60) e.push('clave inválida (minúsculas, números y guiones; 3 a 60)');
  if (!texto(m.nombre, 120) || m.nombre.trim().length < 3) e.push('nombre obligatorio (3 a 120 caracteres)');
  if (!texto(m.descripcion, 500)) e.push('descripcion obligatoria (máx. 500 caracteres)');
  if (typeof m.instrucciones !== 'string' || m.instrucciones.length > 5000) e.push('instrucciones debe ser texto (máx. 5000)');
  if (typeof m.teoria !== 'string' || m.teoria.length > 20000) e.push('teoria debe ser texto (máx. 20000)');
  if (!TIPOS.includes(m.tipo)) e.push(`tipo debe ser uno de: ${TIPOS.join(', ')}`);
  if (!RUNTIMES.includes(m.runtime)) e.push(`runtime debe ser uno de: ${RUNTIMES.join(', ')}`);
  else if (m.runtime === 'integrada') {
    if (!RE_ENTRADA_INTEGRADA.test(m.entrada ?? '')) e.push('entrada (integrada) debe ser una clave del registro, p. ej. "avl"');
    if (!VISTAS_INTEGRADAS.includes(m.vista)) e.push(`vista (integrada) debe ser una de: ${VISTAS_INTEGRADAS.join(', ')}`);
  } else {
    if (!RE_ENTRADA_AISLADA.test(m.entrada ?? '')) e.push('entrada (aislada) debe ser una URL https');
    if (m.vista !== 'personalizada') e.push('vista (aislada) debe ser "personalizada"');
  }
  if (!Array.isArray(m.controles) || m.controles.length === 0 || new Set(m.controles).size !== m.controles.length || !m.controles.every((c) => CONTROLES.includes(c)))
    e.push(`controles debe ser una lista sin repetir con valores de: ${CONTROLES.join(', ')}`);
  else if (!m.controles.includes('reiniciar')) e.push('controles debe incluir "reiniciar"');
  lista(m, 'parametros', 20, e, (p, r) => validarCampoDef(p, r, e, true));
  lista(m, 'acciones', 10, e, (a, r) => {
    if (!a || typeof a !== 'object') return e.push(`${r}: debe ser un objeto`);
    if (!RE_ID.test(a.clave ?? '')) e.push(`${r}.clave inválida`);
    if (!texto(a.etiqueta, 60)) e.push(`${r}.etiqueta obligatoria`);
    if (!Array.isArray(a.campos) || a.campos.length > 8) return e.push(`${r}.campos debe ser una lista de máximo 8`);
    a.campos.forEach((c, i) => validarCampoDef(c, `${r}.campos[${i}]`, e, false));
  });
  return { ok: e.length === 0, errores: e };
}

/** Aplica valores recibidos sobre los parámetros del manifiesto (con defectos). Ignora claves desconocidas. */
export function validarParametros(manifiesto, valores = {}) {
  const out = {}, errores = [];
  for (const def of manifiesto.parametros) {
    const bruto = valores && Object.prototype.hasOwnProperty.call(valores, def.clave) ? valores[def.clave] : def.defecto;
    const r = normalizarCampo(def, bruto);
    if (r.ok) out[def.clave] = r.valor; else errores.push(r.error);
  }
  return { ok: errores.length === 0, valores: out, errores };
}

/** Valida los argumentos de una acción declarada en el manifiesto. */
export function validarArgsAccion(manifiesto, accion, args = {}) {
  const def = manifiesto.acciones.find((a) => a.clave === accion);
  if (!def) return { ok: false, error: `Acción desconocida: ${String(accion).slice(0, 30)}` };
  const out = {};
  for (const c of def.campos) {
    const r = normalizarCampo(c, args?.[c.clave]);
    if (!r.ok) return { ok: false, error: r.error };
    out[c.clave] = r.valor;
  }
  return { ok: true, args: out };
}

/** Convierte un manifiesto en la fila para public.simulaciones (la inserción real la hace M5). */
export function aFilaSimulacion(m, autorId) {
  return {
    autor_id: autorId, clave: m.clave, nombre: m.nombre, descripcion: m.descripcion,
    instrucciones: m.instrucciones, teoria: m.teoria, tipo: m.tipo, runtime: m.runtime,
    punto_entrada: m.entrada, contrato_version: m.contrato,
    manifiesto: { controles: m.controles, parametros: m.parametros, acciones: m.acciones, vista: m.vista },
  };
}

/** Reconstruye el manifiesto completo a partir de una fila de public.simulaciones. */
export function desdeFilaSimulacion(f) {
  return {
    contrato: f.contrato_version, clave: f.clave, nombre: f.nombre, descripcion: f.descripcion,
    instrucciones: f.instrucciones, teoria: f.teoria, tipo: f.tipo, runtime: f.runtime, entrada: f.punto_entrada,
    controles: f.manifiesto?.controles, parametros: f.manifiesto?.parametros ?? [],
    acciones: f.manifiesto?.acciones ?? [], vista: f.manifiesto?.vista,
  };
}
