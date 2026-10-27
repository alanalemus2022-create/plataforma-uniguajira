// Servidor único: autenticación (estilo Supabase Auth), API de datos con RLS real y archivos del frontend.
import http from 'node:http';
import { readFileSync, existsSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, extname, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac, scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { abrirBD } from './db.js';
import { sembrar } from './seed.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(RAIZ, 'dist');
const PUERTO = Number(process.env.PORT || 3000);
const DATOS = process.env.DATA_DIR || join(RAIZ, 'datos');
mkdirSync(DATOS, { recursive: true });
const ARCH_SECRETO = join(DATOS, '.secreto');
if (!existsSync(ARCH_SECRETO)) writeFileSync(ARCH_SECRETO, randomBytes(32).toString('hex'), { mode: 0o600 });
const SECRETO = readFileSync(ARCH_SECRETO, 'utf8');

const db = await abrirBD(join(DATOS, 'pg'));
await sembrar(db, hashClave);

// ---- Sesiones: token firmado con HMAC (sub + exp). La clave privilegiada nunca sale del servidor. ----
function firmar(sub) {
  const cuerpo = Buffer.from(JSON.stringify({ sub, exp: Date.now() + 7 * 864e5 })).toString('base64url');
  return `${cuerpo}.${createHmac('sha256', SECRETO).update(cuerpo).digest('base64url')}`;
}
function verificar(token) {
  const [c, f] = (token || '').split('.');
  if (!c || !f) return null;
  const esperado = createHmac('sha256', SECRETO).update(c).digest();
  const dado = Buffer.from(f, 'base64url');
  if (dado.length !== esperado.length || !timingSafeEqual(dado, esperado)) return null;
  const p = JSON.parse(Buffer.from(c, 'base64url').toString());
  return p.exp > Date.now() ? p.sub : null;
}
function hashClave(clave) { const s = randomBytes(16); return `${s.toString('hex')}:${scryptSync(clave, s, 32).toString('hex')}`; }
function claveOk(clave, h) { const [s, k] = h.split(':'); return timingSafeEqual(scryptSync(clave, Buffer.from(s, 'hex'), 32), Buffer.from(k, 'hex')); }

// ---- Ejecución con RLS: rol de BD + auth.uid() según la sesión ----
async function comoUsuario(sub, fn) {
  return db.transaction(async tx => {
    await tx.query(`set local role ${sub ? 'authenticated' : 'anon'}`);
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [sub || '']);
    return fn(tx);
  });
}

const ID = /^[a-z_][a-z0-9_]*$/;
const OPS = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', ilike: 'ilike' };
const TABLAS = new Set(['simulaciones', 'simulacion_configuraciones', 'favoritos', 'valoraciones', 'valoraciones_resumen', 'comentarios', 'perfiles', 'perfiles_publicos', 'cambios_rol']);
const FUNCIONES = new Set(['registrar_vista', 'panel_autor', 'obtener_configuracion', 'simulacion_es_publica', 'asignar_rol', 'rol_actual']);
const cols = s => (s === '*' || !s) ? '*' : s.split(',').map(c => c.trim()).map(c => { if (!ID.test(c)) throw new Error('columna inválida'); return `"${c}"`; }).join(', ');

function filtros(fs = [], vals) {
  return fs.map(([c, op, v]) => {
    if (!ID.test(c) || !OPS[op]) throw new Error('filtro inválido');
    vals.push(v); return `"${c}" ${OPS[op]} $${vals.length}`;
  }).join(' and ');
}

async function consulta(tx, q) {
  const vals = [];
  if (q.rpc) {
    if (!FUNCIONES.has(q.rpc)) throw new Error('función no permitida');
    const args = Object.entries(q.args || {}).map(([k, v]) => { if (!ID.test(k)) throw new Error('argumento inválido'); vals.push(v); return `${k} => $${vals.length}`; });
    const r = await tx.query(`select * from public.${q.rpc}(${args.join(', ')})`, vals);
    const campos = r.fields.map(f => f.name);
    return campos.length === 1 && campos[0] === q.rpc ? r.rows[0]?.[q.rpc] ?? null : r.rows;
  }
  if (!TABLAS.has(q.table)) throw new Error('tabla no permitida');
  const t = `public."${q.table}"`;
  let sql, r;
  if (q.op === 'select') {
    const w = filtros(q.filtros, vals);
    const ord = (q.orden || []).map(([c, asc]) => { if (!ID.test(c)) throw new Error('orden inválido'); return `"${c}" ${asc ? 'asc' : 'desc'}`; });
    sql = `select ${cols(q.columnas)} from ${t}${w ? ' where ' + w : ''}${ord.length ? ' order by ' + ord.join(', ') : ''}${q.limite ? ` limit ${Math.min(+q.limite | 0, 500)}` : ' limit 500'}`;
  } else if (q.op === 'insert' || q.op === 'upsert') {
    const ks = Object.keys(q.valores || {});
    if (!ks.length || !ks.every(k => ID.test(k))) throw new Error('valores inválidos');
    ks.forEach(k => vals.push(q.valores[k]));
    sql = `insert into ${t} (${ks.map(k => `"${k}"`).join(', ')}) values (${ks.map((_, i) => `$${i + 1}`).join(', ')})`;
    if (q.op === 'upsert') {
      const conf = (q.conflicto || '').split(',').map(s => s.trim()); if (!conf.every(c => ID.test(c))) throw new Error('conflicto inválido');
      const act = ks.filter(k => !conf.includes(k));
      sql += ` on conflict (${conf.map(c => `"${c}"`).join(', ')}) do ${act.length ? 'update set ' + act.map(k => `"${k}" = excluded."${k}"`).join(', ') : 'nothing'}`;
    }
    sql += ` returning ${cols(q.columnas || '*')}`;
  } else if (q.op === 'update') {
    const ks = Object.keys(q.valores || {}); if (!ks.length || !ks.every(k => ID.test(k))) throw new Error('valores inválidos');
    ks.forEach(k => vals.push(q.valores[k]));
    const w = filtros(q.filtros, vals); if (!w) throw new Error('update sin filtro');
    sql = `update ${t} set ${ks.map((k, i) => `"${k}" = $${i + 1}`).join(', ')} where ${w} returning ${cols(q.columnas || '*')}`;
  } else if (q.op === 'delete') {
    const w = filtros(q.filtros, vals); if (!w) throw new Error('delete sin filtro');
    sql = `delete from ${t} where ${w} returning 1 as ok`;
  } else throw new Error('operación inválida');
  r = await tx.query(sql, vals);
  return r.rows;
}

// ---- HTTP ----
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon' };
const leer = req => new Promise((ok, no) => { let b = ''; req.on('data', c => { b += c; if (b.length > 2e6) { no(new Error('cuerpo muy grande')); req.destroy(); } }); req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch { no(new Error('JSON inválido')); } }); });
const responder = (res, code, obj) => { 
  const cuerpo = JSON.stringify(obj, (k, v) => typeof v === 'bigint' ? Number(v) : v);
  res.writeHead(code, { 'content-type': 'application/json' }); 
  res.end(cuerpo); 
};
const sesion = req => verificar((req.headers.authorization || '').replace(/^Bearer /, ''));

http.createServer(async (req, res) => {
  res.setHeader('x-content-type-options', 'nosniff');
  try {
    if (req.method === 'POST' && req.url.startsWith('/api/')) {
      const ruta = req.url.slice(5), b = await leer(req);
      if (ruta === 'registro') {
        const correo = String(b.correo || '').trim().toLowerCase(), clave = String(b.clave || '');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return responder(res, 400, { error: 'Correo no válido' });
        if (clave.length < 8) return responder(res, 400, { error: 'La contraseña debe tener al menos 8 caracteres' });
        if ((await db.query('select 1 from auth.users where email=$1', [correo])).rows.length) return responder(res, 409, { error: 'Ese correo ya está registrado' });
        const u = (await db.query(`insert into auth.users(email, raw_user_meta_data) values ($1, $2) returning id`, [correo, JSON.stringify({ nombre_completo: String(b.nombre || '').slice(0, 120) })])).rows[0];
        await db.query('insert into auth.credenciales values ($1,$2)', [u.id, hashClave(clave)]);
        return responder(res, 200, { token: firmar(u.id), usuario: u.id });
      }
      if (ruta === 'ingreso') {
        const correo = String(b.correo || '').trim().toLowerCase();
        const r = (await db.query('select u.id, c.clave_hash from auth.users u join auth.credenciales c on c.usuario_id=u.id where u.email=$1', [correo])).rows[0];
        if (!r || !claveOk(String(b.clave || ''), r.clave_hash)) return responder(res, 401, { error: 'Correo o contraseña incorrectos' });
        return responder(res, 200, { token: firmar(r.id), usuario: r.id });
      }
      if (ruta === 'consulta') {
        const sub = sesion(req);
        try { return responder(res, 200, { data: await comoUsuario(sub, tx => consulta(tx, b)) }); }
        catch (e) { return responder(res, 200, { error: { message: e.message, code: e.code } }); }
      }
      return responder(res, 404, { error: 'No existe' });
    }
    if (req.method === 'GET' && req.url.startsWith('/ejemplos/')) {
      const f = join(RAIZ, normalize(req.url.split('?')[0]));
      if (f.startsWith(join(RAIZ, 'ejemplos')) && existsSync(f)) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(readFileSync(f)); }
    }
    
    // Archivos estáticos (con regreso a index.html para rutas del frontend)
    let f = join(PUBLIC, normalize(req.url.split('?')[0]));
    
    // Si sale de la carpeta, no existe, o ES UN DIRECTORIO, redirige a index.html
    if (!f.startsWith(PUBLIC) || !existsSync(f) || statSync(f).isDirectory()) {
      f = join(PUBLIC, 'index.html');
    }
    
    if (!existsSync(f)) { 
      res.writeHead(500); 
      return res.end('Falta compilar el frontend: ejecuta "npm run build"'); 
    }
    
    res.writeHead(200, { 'content-type': TIPOS[extname(f)] || 'application/octet-stream' });
    res.end(readFileSync(f));
    
  } catch (e) { 
    console.error("\n❌ ERROR ORIGINAL REVELADO:", e); 
    if (!res.headersSent) {
      responder(res, 500, { error: 'Error interno' }); 
    }
  }
}).listen(PUERTO, () => console.log(`\n  Plataforma de Simulaciones lista en http://localhost:${PUERTO}\n`));