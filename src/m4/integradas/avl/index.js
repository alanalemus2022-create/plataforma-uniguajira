// M4 · Simulación de ejemplo: árboles AVL (RF-14). Cumple el contrato común v1.
import { crearMotorAvl } from './motor.js';

export const manifiesto = {
  contrato: 1,
  clave: 'arboles-avl',
  nombre: 'Visualizador de árboles AVL',
  descripcion: 'Inserta y elimina nodos en un árbol AVL y observa, paso a paso, cómo se recalculan los factores de balance y se aplican las rotaciones.',
  instrucciones: 'Escribe un número y pulsa Insertar o Eliminar. Usa Iniciar para ver la animación, Paso para avanzar de a un paso y Paso atrás para retroceder. "Cargar ejemplo" crea un árbol equilibrado; prueba insertar 10 y luego 5 para provocar una rotación.',
  teoria: 'Un árbol AVL es un árbol binario de búsqueda que se mantiene equilibrado: para cada nodo, el factor de balance FB = altura(izquierdo) − altura(derecho) debe ser −1, 0 o 1.\n\nSi tras insertar o eliminar algún nodo queda con |FB| = 2, se rota:\n• Izquierda-izquierda (LL): rotación simple a la derecha.\n• Derecha-derecha (RR): rotación simple a la izquierda.\n• Izquierda-derecha (LR): rotación izquierda en el hijo y luego derecha en el nodo.\n• Derecha-izquierda (RL): rotación derecha en el hijo y luego izquierda en el nodo.\n\nInsertar, eliminar y buscar cuestan O(log n).',
  tipo: 'visualizador',
  runtime: 'integrada',
  entrada: 'arboles-avl',
  vista: 'arbol',
  controles: ['iniciar', 'pausar', 'reiniciar', 'paso', 'paso_atras', 'velocidad'],
  parametros: [
    { clave: 'mostrar_fb', etiqueta: 'Mostrar factor de balance', tipo: 'booleano', defecto: true },
    { clave: 'mostrar_altura', etiqueta: 'Mostrar altura', tipo: 'booleano', defecto: false },
  ],
  acciones: [
    { clave: 'insertar', etiqueta: 'Insertar', campos: [{ clave: 'valor', etiqueta: 'Valor', tipo: 'entero', min: -999, max: 999 }] },
    { clave: 'eliminar', etiqueta: 'Eliminar', campos: [{ clave: 'valor', etiqueta: 'Valor', tipo: 'entero', min: -999, max: 999 }] },
    { clave: 'cargar_ejemplo', etiqueta: 'Cargar ejemplo', campos: [] },
  ],
};

export function crear() {
  const m = crearMotorAvl();
  let opciones = { mostrarFb: true, mostrarAltura: false };
  return {
    frameActual: () => ({ ...m.frameActual(), opciones }),
    posicion: m.posicion, avanzar: m.avanzar, retroceder: m.retroceder, reiniciar: m.reiniciar,
    ajustar: (p) => { opciones = { mostrarFb: p.mostrar_fb !== false, mostrarAltura: p.mostrar_altura === true }; },
    ejecutar(accion, args) {
      if (accion === 'insertar') return m.insertar(args.valor);
      if (accion === 'eliminar') return m.eliminar(args.valor);
      if (accion === 'cargar_ejemplo') return m.cargarEjemplo();
      return { ok: false, error: 'Acción no soportada' };
    },
  };
}
