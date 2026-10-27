// M4 · Posiciones de un árbol binario para dibujarlo en SVG (inorden → x, profundidad → y).
export function calcularLayout(arbol, { dx = 48, dy = 64, margen = 32, radio = 20 } = {}) {
  if (!arbol) return { nodos: [], aristas: [], ancho: 2 * margen, alto: 2 * margen, radio };
  let col = 0, prof = 0; const nodos = [], aristas = [];
  const rec = (n, nivel, padre) => {
    if (!n) return;
    rec(n.i, nivel + 1, n);
    const pos = { v: n.v, h: n.h, fb: n.fb, x: margen + col * dx, y: margen + nivel * dy };
    col++; prof = Math.max(prof, nivel); nodos.push(pos);
    if (padre) pos.padre = padre.v;
    rec(n.d, nivel + 1, n);
  };
  rec(arbol, 0, null);
  const porValor = new Map(nodos.map((n) => [n.v, n]));
  for (const n of nodos) if (n.padre !== undefined) aristas.push({ de: porValor.get(n.padre), a: n });
  return { nodos, aristas, ancho: 2 * margen + (col - 1) * dx, alto: 2 * margen + prof * dy, radio };
}
