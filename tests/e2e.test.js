// Prueba de integración M1+M4+M6 contra el servidor en marcha: PORT=3111 node --test tests/e2e.test.js
import test from 'node:test'; import assert from 'node:assert/strict';
const B = `http://localhost:${process.env.PORT || 3111}/api/`;
const post = async (r, b, t) => (await fetch(B + r, { method: 'POST', headers: { 'content-type': 'application/json', ...(t ? { authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(b) })).json();
const q = async (b, t) => (await post('consulta', b, t));
const sel = (table, filtros = [], columnas = '*', t) => q({ table, op: 'select', filtros, columnas }, t).then(r => r.data ?? r);
let adm, est, est2, simId;
test('ingreso de administrador y estudiante demo', async () => {
  adm = (await post('ingreso', { correo: 'admin@uniguajira.edu.co', clave: 'Admin12345' })).token;
  est = (await post('ingreso', { correo: 'estudiante@uniguajira.edu.co', clave: 'Estudiante12345' })).token;
  assert.ok(adm && est);
  assert.equal((await post('ingreso', { correo: 'estudiante@uniguajira.edu.co', clave: 'mala' })).error, 'Correo o contraseña incorrectos');
});
test('registro: rol siempre estudiante aunque el cliente intente otro', async () => {
  const r = await post('registro', { correo: `x${Date.now()}@u.co`, clave: 'clave12345', nombre: 'Ana', rol: 'administrador' });
  est2 = r.token; assert.ok(est2);
  const p = await sel('perfiles', [], 'rol,nombre_completo', est2); assert.equal(p.length, 1); assert.equal(p[0].rol, 'estudiante');
});
test('visitante ve simulaciones publicadas, no perfiles ni favoritos', async () => {
  const s = await sel('simulaciones', [['estado', 'eq', 'publicada']], 'id,clave'); assert.equal(s[0].clave, 'arboles-avl'); simId = s[0].id;
  assert.ok((await q({ table: 'perfiles', op: 'select' })).error);
  assert.ok((await q({ table: 'favoritos', op: 'select' })).error);
});
test('estudiante no puede subirse el rol ni leer otros perfiles', async () => {
  const r = await q({ table: 'perfiles', op: 'update', valores: { rol: 'administrador' }, filtros: [['correo', 'eq', 'estudiante@uniguajira.edu.co']] }, est); assert.ok(r.error);
  assert.equal((await sel('perfiles', [], 'id', est)).length, 1);
  assert.ok((await q({ rpc: 'asignar_rol', args: { p_usuario: '00000000-0000-0000-0000-000000000000', p_rol: 'profesor' } }, est)).error);
});
test('M6: vista, valoración, favorito y comentario', async () => {
  assert.equal((await q({ rpc: 'registrar_vista', args: { p_simulacion_id: simId, p_token: 'a'.repeat(36) } })).data, true);
  assert.equal((await q({ rpc: 'registrar_vista', args: { p_simulacion_id: simId, p_token: 'a'.repeat(36) } })).data, false); // misma persona/día
  const uid = JSON.parse(Buffer.from(est.split('.')[0], 'base64url')).sub;
  assert.ok(!(await q({ table: 'valoraciones', op: 'upsert', conflicto: 'usuario_id,simulacion_id', valores: { simulacion_id: simId, usuario_id: uid, puntaje: 4 } }, est)).error);
  assert.ok((await q({ table: 'valoraciones', op: 'upsert', conflicto: 'usuario_id,simulacion_id', valores: { simulacion_id: simId, usuario_id: uid, puntaje: 9 } }, est)).error);
  assert.ok(!(await q({ table: 'favoritos', op: 'insert', valores: { simulacion_id: simId, usuario_id: uid } }, est)).error);
  assert.ok(!(await q({ table: 'comentarios', op: 'insert', valores: { simulacion_id: simId, usuario_id: uid, contenido: 'Muy útil' } }, est)).error);
  const res = await sel('valoraciones_resumen', [], '*'); assert.equal(Number(res[0].promedio), 4);
  assert.equal((await sel('comentarios', [], '*')).length, 1);
});
test('M6: el autor no puede valorar lo suyo; panel_autor lo ve el autor', async () => {
  const aid = JSON.parse(Buffer.from(adm.split('.')[0], 'base64url')).sub;
  assert.ok((await q({ table: 'valoraciones', op: 'insert', valores: { simulacion_id: simId, usuario_id: aid, puntaje: 5 } }, adm)).error);
  const p = (await q({ rpc: 'panel_autor' }, adm)).data; assert.equal(p[0].vistas, 1);
});
test('M6: suplantación — no se puede comentar a nombre de otro', async () => {
  const aid = JSON.parse(Buffer.from(adm.split('.')[0], 'base64url')).sub;
  assert.ok((await q({ table: 'comentarios', op: 'insert', valores: { simulacion_id: simId, usuario_id: aid, contenido: 'x' } }, est)).error);
});
test('perfiles_publicos solo expone id y nombre', async () => {
  const r = await sel('perfiles_publicos', [], '*'); assert.deepEqual(Object.keys(r[0]).sort(), ['id', 'nombre_completo']);
});
