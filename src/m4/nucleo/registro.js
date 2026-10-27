// M4 · Registro de simulaciones integradas (RNF-05). Agregar una simulación = carpeta nueva + una línea en integradas/index.js.
import { validarManifiesto } from '../contrato/manifiesto.js';

const METODOS = ['frameActual', 'posicion', 'avanzar', 'retroceder', 'reiniciar', 'ejecutar', 'ajustar'];

export function verificarInstancia(inst) {
  const faltan = METODOS.filter((m) => typeof inst?.[m] !== 'function');
  if (faltan.length) throw new Error(`La instancia no cumple el contrato; faltan: ${faltan.join(', ')}`);
  return inst;
}

/** cargadores: { clave: () => import('./x/index.js') }. Cada módulo exporta `manifiesto` y `crear()`. */
export function crearRegistro(cargadores) {
  return {
    claves: () => Object.keys(cargadores),
    tiene: (clave) => Object.prototype.hasOwnProperty.call(cargadores, clave),
    async cargar(clave) {
      if (!this.tiene(clave)) throw new Error(`No hay una simulación integrada con clave "${clave}"`);
      const mod = await cargadores[clave]();
      const v = validarManifiesto(mod.manifiesto);
      if (!v.ok) throw new Error(`Manifiesto inválido en "${clave}": ${v.errores.join('; ')}`);
      if (mod.manifiesto.runtime !== 'integrada') throw new Error(`"${clave}" no es integrada`);
      if (typeof mod.crear !== 'function') throw new Error(`"${clave}" no exporta crear()`);
      return { manifiesto: mod.manifiesto, crear: () => verificarInstancia(mod.crear()) };
    },
  };
}
