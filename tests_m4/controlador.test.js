import test from 'node:test';
import assert from 'node:assert/strict';
import { crearControlador } from '../src/m4/nucleo/controlador.js';
import { crearRegistro } from '../src/m4/nucleo/registro.js';
import { manifiesto, crear } from '../src/m4/integradas/avl/index.js';

function reloj() {
  let id = 0; const cola = new Map();
  return { despues: (fn) => { cola.set(++id, fn); return id; }, cancelar: (i) => cola.delete(i),
    tick() { const [k, fn] = cola.entries().next().value ?? []; if (!fn) return false; cola.delete(k); fn(); return true; }, pendientes: () => cola.size };
}
const nuevo = (op = {}) => { const r = reloj(); const c = crearControlador(crear(), manifiesto, { programador: r, ...op }); return { r, c }; };

test('ejecutar + iniciar reproduce paso a paso hasta terminar', () => {
  const { r, c } = nuevo();
  c.ejecutar('insertar', { valor: 10 }); c.ejecutar('insertar', { valor: 20 });
  assert.equal(c.estado().estado, 'reproduciendo');
  let pasos = 0; while (r.tick()) pasos++;
  assert.ok(pasos >= 2); assert.equal(c.estado().estado, 'listo'); assert.equal(c.estado().indice, c.estado().total - 1);
});

test('pausar detiene; paso y paso atrás navegan; reiniciar limpia', () => {
  const { r, c } = nuevo();
  c.ejecutar('cargar_ejemplo', {}); while (r.tick());
  c.ejecutar('insertar', { valor: 10 }); c.ejecutar('insertar', { valor: 5 });
  r.tick(); c.pausar(); assert.equal(c.estado().estado, 'pausado'); assert.equal(r.pendientes(), 0);
  const i = c.estado().indice; c.paso(); assert.equal(c.estado().indice, i + 1); c.pasoAtras(); assert.equal(c.estado().indice, i);
  c.reiniciar(); assert.equal(c.estado().frame.arbol, null); assert.equal(c.estado().estado, 'listo');
});

test('reproducirAlEjecutar:false deja los pasos pendientes (modo paso a paso)', () => {
  const { c } = nuevo({ reproducirAlEjecutar: false });
  c.ejecutar('insertar', { valor: 1 }); c.ejecutar('insertar', { valor: 2 });
  assert.equal(c.estado().estado, 'pausado');
});

test('valida acciones y parámetros; no llama a la instancia con datos inválidos', () => {
  const { c } = nuevo();
  assert.equal(c.ejecutar('insertar', { valor: 'abc' }).ok, false); assert.match(c.estado().aviso, /entero/);
  assert.equal(c.ejecutar('insertar', { valor: 99999 }).ok, false);
  assert.equal(c.ejecutar('formatear', {}).ok, false);
  assert.equal(c.setParametro('mostrar_fb', 'no').ok, false);
  assert.equal(c.setParametro('mostrar_fb', false).ok, true); assert.equal(c.estado().frame.opciones.mostrarFb, false);
  assert.equal(c.setParametro('inexistente', 1).ok, false);
});

test('velocidad se limita a 100–3000 ms', () => {
  const { c } = nuevo(); c.setVelocidad(5); assert.equal(c.estado().velocidadMs, 100); c.setVelocidad(99999); assert.equal(c.estado().velocidadMs, 3000);
});

test('un error de la instancia pasa a estado error sin romper; reiniciar lo recupera', () => {
  const inst = crear(); const orig = inst.ejecutar; inst.ejecutar = () => { throw new Error('boom'); };
  const c = crearControlador(inst, manifiesto, { programador: reloj() });
  c.ejecutar('insertar', { valor: 1 }); assert.equal(c.estado().estado, 'error'); assert.equal(c.estado().error, 'boom');
  assert.equal(c.ejecutar('insertar', { valor: 2 }).ok, false);
  inst.ejecutar = orig; c.reiniciar(); assert.equal(c.estado().estado, 'listo');
});

test('suscripción notifica cambios y se puede cancelar; estado() es estable entre cambios', () => {
  const { c } = nuevo(); let n = 0; const off = c.suscribir(() => n++);
  const a = c.estado(); assert.equal(c.estado(), a);
  c.ejecutar('insertar', { valor: 1 }); assert.ok(n > 0); const k = n; off(); c.ejecutar('insertar', { valor: 2 }); assert.equal(n, k);
});

test('exportar/importar configuración reproduce el mismo árbol (RF-15)', () => {
  const a = nuevo({ reproducirAlEjecutar: false }); [5, 3, 8, 1, 4].forEach((v) => a.c.ejecutar('insertar', { valor: v }));
  a.c.setParametro('mostrar_altura', true);
  const cfg = JSON.parse(JSON.stringify(a.c.exportarConfiguracion()));
  while (a.c.estado().pendiente) a.c.paso();
  const b = nuevo(); const res = b.c.importarConfiguracion(cfg);
  assert.equal(res.ok, true); assert.equal(b.c.estado().estado, 'listo'); assert.equal(b.c.estado().parametros.mostrar_altura, true);
  assert.deepEqual(b.c.estado().frame.arbol, a.c.estado().frame.arbol);
});

test('importarConfiguracion rechaza datos hostiles sin modificar nada', () => {
  const { c } = nuevo(); c.ejecutar('insertar', { valor: 7 }); const antes = JSON.stringify(c.estado().frame.arbol);
  for (const cfg of [null, { version: 2 }, { version: 1, parametros: { mostrar_fb: 'x' } }, { version: 1, acciones: [{ accion: 'rm', args: {} }] },
    { version: 1, acciones: Array(201).fill({ accion: 'insertar', args: { valor: 1 } }) }, { version: 1, acciones: [{ accion: 'insertar', args: { valor: 1e9 } }] }]) {
    assert.equal(c.importarConfiguracion(cfg).ok, false);
  }
  assert.equal(JSON.stringify(c.estado().frame.arbol), antes);
});

test('registro: carga integradas válidas y rechaza claves o instancias inválidas', async () => {
  const reg = crearRegistro({ 'arboles-avl': () => import('../src/m4/integradas/avl/index.js'), roto: async () => ({ manifiesto: { ...manifiesto, clave: 'X' }, crear }), sinCrear: async () => ({ manifiesto }), mala: async () => ({ manifiesto, crear: () => ({}) }) });
  const sim = await reg.cargar('arboles-avl'); assert.equal(sim.manifiesto.clave, 'arboles-avl'); assert.equal(typeof sim.crear().avanzar, 'function');
  await assert.rejects(reg.cargar('no-existe'), /No hay/); await assert.rejects(reg.cargar('roto'), /inválido/);
  await assert.rejects(reg.cargar('sinCrear'), /crear/); assert.throws((await reg.cargar('mala')).crear, /contrato/);
  assert.deepEqual(reg.claves().slice(0, 1), ['arboles-avl']);
});
