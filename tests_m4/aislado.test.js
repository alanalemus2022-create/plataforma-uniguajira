import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { prepararDocumentoAislado, descargarHtmlAislado, CSP, ATRIBUTOS_SANDBOX, MAX_BYTES_HTML } from '../src/m4/aislado/documento.js';
import { SDK_FUENTE } from '../src/m4/aislado/sdk-fuente.js';
import { crearPuente, CANAL } from '../src/m4/aislado/puente.js';
import { obtenerTokenVisitante, _reiniciarParaPruebas } from '../src/m4/nucleo/token.js';

const manif = { controles: ['iniciar', 'pausar', 'reiniciar', 'paso', 'paso_atras', 'velocidad'], parametros: [{ clave: 'maximo', etiqueta: 'Máximo', tipo: 'entero', min: 1, max: 100, defecto: 10 }], acciones: [{ clave: 'poner', etiqueta: 'Poner', campos: [{ clave: 'n', etiqueta: 'N', tipo: 'entero', min: 0, max: 9 }] }] };
function entorno() {
  const oyentes = []; const enviados = [];
  const ventana = { addEventListener: (_, f) => oyentes.push(f), removeEventListener: (_, f) => oyentes.splice(oyentes.indexOf(f), 1) };
  const destino = { postMessage: (m, o) => enviados.push([m, o]) };
  const reloj = (() => { let f = null; return { despues: (fn) => { f = fn; return 1; }, cancelar: () => { f = null; }, disparar: () => f?.() }; })();
  const p = crearPuente({ ventana, destino, manifiesto: manif, programador: reloj });
  const desde = (data, o = {}) => oyentes.forEach((f) => f({ source: destino, origin: 'null', data: { canal: CANAL, version: 1, ...data }, ...o }));
  return { p, desde, enviados, oyentes, reloj, destino };
}

test('el documento aislado pone CSP antes que el contenido y SDK antes que el autor', () => {
  const d = prepararDocumentoAislado('<p id="x">hola</p><script>1</script>');
  assert.ok(d.indexOf('Content-Security-Policy') < d.indexOf('UniSim') && d.indexOf('UniSim') < d.indexOf('id="x"'));
  assert.match(CSP, /connect-src 'none'/); assert.match(CSP, /default-src 'none'/);
  assert.equal(ATRIBUTOS_SANDBOX, 'allow-scripts'); assert.doesNotMatch(ATRIBUTOS_SANDBOX, /same-origin|top-navigation|popups|forms/);
  assert.throws(() => prepararDocumentoAislado('x'.repeat(MAX_BYTES_HTML + 1)), /2 MB/); assert.throws(() => prepararDocumentoAislado(null));
});

test('descargarHtmlAislado solo admite https de orígenes permitidos', async () => {
  const ok = { origenesPermitidos: ['https://a.supabase.co'], fetchFn: async (u, o) => { assert.equal(o.credentials, 'omit'); assert.equal(o.redirect, 'error'); return { ok: true, text: async () => '<p>x</p>' }; } };
  assert.equal(await descargarHtmlAislado('https://a.supabase.co/x.html', ok), '<p>x</p>');
  for (const u of ['http://a.supabase.co/x.html', 'https://evil.com/x.html', 'javascript:alert(1)', 'no es url']) await assert.rejects(descargarHtmlAislado(u, ok));
  await assert.rejects(descargarHtmlAislado('https://a.supabase.co/x', { ...ok, fetchFn: async () => ({ ok: false, status: 404 }) }), /404/);
});

test('puente: acepta solo mensajes del iframe, origen "null" y canal correcto', () => {
  const { p, desde, destino } = entorno();
  desde({ evento: 'listo' }, { source: {} }); desde({ evento: 'listo' }, { origin: 'https://evil.com' }); desde({ evento: 'listo', canal: 'otro' });
  desde({ evento: 'listo', version: 2 }); assert.equal(p.estado().estado, 'cargando');
  desde({ evento: 'listo' }); assert.equal(p.estado().estado, 'listo'); assert.ok(destino);
});

test('puente: al estar listo envía los parámetros por defecto y saneó los estados recibidos', () => {
  const { p, desde, enviados } = entorno();
  desde({ evento: 'listo' });
  assert.deepEqual(enviados.map(([m]) => m).find((m) => m.cmd === 'parametro'), { canal: CANAL, version: 1, cmd: 'parametro', clave: 'maximo', valor: 10 });
  assert.ok(enviados.every(([, o]) => o === '*'));
  desde({ evento: 'estado', estado: 'reproduciendo', indice: 3, total: 11, mensaje: 'm'.repeat(1000) });
  assert.equal(p.estado().estado, 'reproduciendo'); assert.equal(p.estado().mensaje.length, 300); assert.equal(p.estado().pendiente, true);
  desde({ evento: 'estado', estado: '<script>', indice: 1, total: 2 }); assert.equal(p.estado().estado, 'reproduciendo');
  desde({ evento: 'estado', estado: 'pausado', indice: -5, total: 1e12 }); assert.deepEqual([p.estado().indice, p.estado().total], [0, 0]);
  desde({ evento: 'error', mensaje: 'falló' }); assert.equal(p.estado().estado, 'error'); assert.equal(p.estado().error, 'falló');
});

test('puente: valida comandos antes de enviarlos', () => {
  const { p, desde, enviados } = entorno(); desde({ evento: 'listo' }); enviados.length = 0;
  p.iniciar(); p.paso(); p.pasoAtras(); p.pausar(); p.setVelocidad(50);
  assert.deepEqual(enviados.map(([m]) => m.cmd), ['iniciar', 'paso', 'paso_atras', 'pausar', 'velocidad']); assert.equal(enviados.at(-1)[0].ms, 100);
  enviados.length = 0;
  assert.equal(p.ejecutar('poner', { n: 50 }).ok, false); assert.equal(p.ejecutar('borrar', {}).ok, false); assert.equal(enviados.length, 0);
  assert.equal(p.ejecutar('poner', { n: '4' }).ok, true); assert.equal(enviados[0][0].args.n, 4);
  assert.equal(p.setParametro('maximo', 500).ok, false); assert.equal(p.setParametro('maximo', 20).ok, true);
});

test('puente: timeout si la simulación no usa el SDK; dispose quita el listener', () => {
  const { p, reloj, oyentes, enviados } = entorno();
  p.alCargar(); assert.equal(enviados.at(-1)[0].cmd, 'hola'); reloj.disparar();
  assert.equal(p.estado().estado, 'error'); assert.match(p.estado().error, /no respondió/);
  p.dispose(); assert.equal(oyentes.length, 0);
});

test('SDK en vm: responde a hola, ejecuta manejadores y reporta errores del autor', () => {
  const enviados = []; const oy = [];
  const parent = { postMessage: (m) => enviados.push(m) };
  const win = { parent, addEventListener: (_, f) => oy.push(f) }; win.window = win;
  vm.runInNewContext(SDK_FUENTE, win);
  const llamadas = [];
  win.UniSim.registrar({ iniciar: () => llamadas.push('iniciar'), parametro: (k, v) => llamadas.push([k, v]), paso: () => { throw new Error('mal'); } });
  assert.equal(enviados.at(-1).evento, 'listo');
  const msg = (data, source = parent) => oy.forEach((f) => f({ source, data: { canal: CANAL, version: 1, ...data } }));
  msg({ cmd: 'iniciar' }); msg({ cmd: 'parametro', clave: 'a', valor: 2 }); msg({ cmd: 'iniciar' }, {}); msg({ cmd: 'paso' }); msg({ cmd: 'hola' });
  assert.deepEqual(llamadas, ['iniciar', ['a', 2]]);
  assert.ok(enviados.some((m) => m.evento === 'error' && m.mensaje === 'mal')); assert.equal(enviados.at(-1).evento, 'listo');
  win.UniSim.estado({ estado: 'pausado', indice: 2.7, total: 5, mensaje: 'x' }); assert.equal(enviados.at(-1).indice, 2);
});

test('el ejemplo de simulación aislada funciona con el SDK (contador)', () => {
  const html = readFileSync(new URL('../ejemplos/simulacion-aislada-ejemplo.html', import.meta.url), 'utf8');
  const codigo = html.match(/<script>([\s\S]*)<\/script>/)[1];
  const enviados = []; const oy = []; const parent = { postMessage: (m) => enviados.push(m) };
  const nodo = { textContent: '' }; const timers = [];
  const win = { parent, addEventListener: (_, f) => oy.push(f), document: { getElementById: () => nodo }, setInterval: (f) => { timers.push(f); return timers.length; }, clearInterval: () => {} };
  win.window = win; vm.runInNewContext(SDK_FUENTE, win); vm.runInNewContext(codigo, win);
  const msg = (data) => oy.forEach((f) => f({ source: parent, data: { canal: CANAL, version: 1, ...data } }));
  msg({ cmd: 'paso' }); msg({ cmd: 'paso' }); assert.equal(nodo.textContent, 2); msg({ cmd: 'paso_atras' }); assert.equal(nodo.textContent, 1);
  msg({ cmd: 'reiniciar' }); assert.equal(nodo.textContent, 0); assert.equal(enviados.at(-1).estado, 'listo');
});

test('token de visitante: aleatorio, persistente y válido para registrar_vista (16–128)', () => {
  _reiniciarParaPruebas(); const mem = new Map(); const alm = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const t = obtenerTokenVisitante(alm, { randomUUID: () => '123e4567-e89b-12d3-a456-426614174000' });
  assert.ok(t.length >= 16 && t.length <= 128); assert.equal(obtenerTokenVisitante(alm), t);
  _reiniciarParaPruebas(); const roto = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };
  assert.ok(obtenerTokenVisitante(roto).length >= 16);
});
