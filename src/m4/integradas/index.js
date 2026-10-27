// M4 · Catálogo de simulaciones integradas. Para agregar una: crear carpeta con index.js (manifiesto + crear) y añadir UNA línea.
// (Con Vite también sirve import.meta.glob('./*/index.js') y no hay que editar este archivo.)
export const cargadores = {
  'arboles-avl': () => import('./avl/index.js'),
};
