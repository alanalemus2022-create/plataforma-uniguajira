import test from 'node:test';
import assert from 'node:assert/strict';
import { validarManifiesto, validarParametros, validarArgsAccion, aFilaSimulacion, desdeFilaSimulacion, normalizarCampo } from '../src/m4/contrato/manifiesto.js';
import { manifiesto as avl } from '../src/m4/integradas/avl/index.js';

const aislada = () => ({ ...structuredClone(avl), clave: 'contador', runtime: 'aislada', entrada: 'https://x.co/c.html', vista: 'personalizada' });

test('el manifiesto de AVL es válido', () => assert.deepEqual(validarManifiesto(avl), { ok: true, errores: [] }));
test('un manifiesto aislado válido pasa', () => assert.equal(validarManifiesto(aislada()).ok, true));

test('rechaza entradas inválidas', () => {
  const casos = [
    [{ contrato: 2 }, /contrato/], [{ clave: 'AVL!' }, /clave/], [{ nombre: 'ab' }, /nombre/], [{ tipo: 'x' }, /tipo/],
    [{ runtime: 'otro' }, /runtime/], [{ entrada: 'http://x.co/a.html', runtime: 'aislada', vista: 'personalizada' }, /https/],
    [{ controles: ['iniciar'] }, /reiniciar/], [{ controles: ['volar', 'reiniciar'] }, /controles/],
    [{ parametros: [{ clave: 'a', etiqueta: 'A', tipo: 'entero', min: 5, max: 1, defecto: 1 }] }, /min/],
    [{ parametros: [{ clave: 'a', etiqueta: 'A', tipo: 'entero', min: 0, max: 9, defecto: 99 }] }, /defecto/],
    [{ parametros: [{ clave: 'A!', etiqueta: 'A', tipo: 'booleano', defecto: true }] }, /clave/],
    [{ acciones: [{ clave: 'x', etiqueta: 'X', campos: Array(9).fill({ clave: 'a', etiqueta: 'A', tipo: 'booleano' }) }] }, /máximo 8/],
  ];
  for (const [cambio, re] of casos) {
    const r = validarManifiesto({ ...structuredClone(avl), ...cambio });
    assert.equal(r.ok, false, JSON.stringify(cambio));
    assert.match(r.errores.join('|'), re);
  }
  assert.equal(validarManifiesto(null).ok, false);
  assert.equal(validarManifiesto({ ...structuredClone(avl), runtime: 'integrada', vista: 'personalizada' }).ok, false);
});

test('normalizarCampo convierte textos numéricos y rechaza fuera de rango', () => {
  const def = { tipo: 'entero', etiqueta: 'N', min: 0, max: 10 };
  assert.deepEqual(normalizarCampo(def, '7'), { ok: true, valor: 7 });
  assert.equal(normalizarCampo(def, '7.5').ok, false);
  assert.equal(normalizarCampo(def, 11).ok, false);
  assert.equal(normalizarCampo(def, '').ok, false);
  assert.equal(normalizarCampo({ tipo: 'booleano', etiqueta: 'B' }, 'true').ok, false);
});

test('validarParametros aplica defectos e ignora claves desconocidas', () => {
  const r = validarParametros(avl, { mostrar_altura: true, intruso: 1 });
  assert.deepEqual(r.valores, { mostrar_fb: true, mostrar_altura: true });
  assert.equal(validarParametros(avl, { mostrar_fb: 'sí' }).ok, false);
});

test('validarArgsAccion', () => {
  assert.deepEqual(validarArgsAccion(avl, 'insertar', { valor: '5' }), { ok: true, args: { valor: 5 } });
  assert.equal(validarArgsAccion(avl, 'insertar', { valor: 5000 }).ok, false);
  assert.equal(validarArgsAccion(avl, 'borrar_todo', {}).ok, false);
});

test('fila ↔ manifiesto es reversible', () => {
  const fila = aFilaSimulacion(avl, 'uuid-autor');
  assert.equal(fila.punto_entrada, 'arboles-avl');
  assert.equal(fila.contrato_version, 1);
  assert.deepEqual(desdeFilaSimulacion(fila), avl);
});
