import test from 'node:test';
import assert from 'node:assert/strict';
import { crearMotorAvl, esAvlValido } from '../src/m4/integradas/avl/motor.js';
import { calcularLayout } from '../src/m4/nucleo/layoutArbol.js';

const inorden = (a) => (a ? [...inorden(a.i), a.v, ...inorden(a.d)] : []);
const construir = (vals) => { const m = crearMotorAvl(); vals.forEach((v) => m.insertar(v)); return m; };
const finalFrames = (m) => { const out = []; do out.push(m.frameActual()); while (m.avanzar()); return out; };

test('las cuatro rotaciones dejan la raíz esperada', () => {
  for (const [vals, raiz, regla] of [[[30, 20, 10], 20, /izquierda-izquierda/], [[10, 20, 30], 20, /derecha-derecha/], [[30, 10, 20], 20, /izquierda-derecha/], [[10, 30, 20], 20, /derecha-izquierda/]]) {
    const m = construir(vals.slice(0, -1)); m.insertar(vals.at(-1));
    assert.equal(m.arbol().v, raiz);
    assert.equal(esAvlValido(m.arbol()).ok, true);
    assert.match(finalFrames(m).map((f) => f.regla ?? '').join(' '), regla);
  }
});

test('frame 0 es el estado previo y cada frame tiene forma válida', () => {
  const m = construir([50, 30, 70]); const antes = JSON.stringify(m.arbol());
  m.insertar(20); m.insertar(10);
  const fr = finalFrames(m);
  assert.ok(fr.length >= 3);
  for (const f of fr) { assert.equal(f.vista, 'arbol'); assert.equal(typeof f.mensaje, 'string'); assert.ok(Array.isArray(f.resaltados.rotado)); }
  assert.notEqual(JSON.stringify(fr[0].arbol), JSON.stringify(fr.at(-1).arbol));
  assert.ok(antes.length > 0);
});

test('duplicados y valores inexistentes no cambian el árbol', () => {
  const m = construir([2, 1, 3]); const a = JSON.stringify(m.arbol());
  m.insertar(2); assert.match(m.frameActual().mensaje, /ya está/); assert.equal(JSON.stringify(m.arbol()), a);
  m.eliminar(99); assert.match(m.frameActual().mensaje, /no está/); assert.equal(JSON.stringify(m.arbol()), a);
});

test('eliminar: hoja, un hijo, dos hijos y raíz única', () => {
  const m = construir([50, 30, 70, 20, 40, 60, 80]);
  m.eliminar(20); assert.deepEqual(inorden(m.arbol()), [30, 40, 50, 60, 70, 80]);
  m.eliminar(50); assert.deepEqual(inorden(m.arbol()), [30, 40, 60, 70, 80]); assert.equal(esAvlValido(m.arbol()).ok, true);
  const u = construir([1]); u.eliminar(1); assert.equal(u.arbol(), null);
});

test('eliminación que obliga a rotar', () => {
  const m = construir([2, 1, 4, 3, 5]); m.eliminar(1);
  assert.equal(esAvlValido(m.arbol()).ok, true); assert.deepEqual(inorden(m.arbol()), [2, 3, 4, 5]);
});

test('fuzz: 3000 operaciones aleatorias mantienen BST + AVL + contenido igual a un Set', () => {
  let s = 12345; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const m = crearMotorAvl(); const ref = new Set();
  for (let i = 0; i < 3000; i++) {
    const v = Math.floor(rnd() * 120) - 20;
    if (rnd() < 0.55) { m.insertar(v); ref.add(v); } else { m.eliminar(v); ref.delete(v); }
    while (m.avanzar());
    assert.equal(esAvlValido(m.arbol()).ok, true, `op ${i}`);
    assert.deepEqual(inorden(m.arbol()), [...ref].sort((a, b) => a - b), `op ${i}`);
  }
});

test('navegación de frames y reinicio', () => {
  const m = construir([1, 2]); m.insertar(3);
  const { total } = m.posicion(); assert.ok(total > 1);
  assert.equal(m.retroceder(), false); assert.equal(m.avanzar(), true); assert.equal(m.retroceder(), true);
  m.reiniciar(); assert.equal(m.arbol(), null); assert.deepEqual(m.posicion(), { indice: 0, total: 1 });
});

test('cargarEjemplo produce un árbol de 7 nodos equilibrado', () => {
  const m = crearMotorAvl(); m.cargarEjemplo();
  assert.deepEqual(inorden(m.arbol()), [20, 30, 40, 50, 60, 70, 80]); assert.equal(m.arbol().h, 3);
});

test('layout: x crece con el inorden, y con la profundidad', () => {
  const m = construir([2, 1, 3]); const L = calcularLayout(m.arbol());
  assert.equal(L.nodos.length, 3); assert.equal(L.aristas.length, 2);
  const x = Object.fromEntries(L.nodos.map((n) => [n.v, n])); assert.ok(x[1].x < x[2].x && x[2].x < x[3].x); assert.ok(x[2].y < x[1].y);
  assert.deepEqual(calcularLayout(null).nodos, []);
});
