// Base de datos embebida: PostgreSQL real (PGlite) con las migraciones SIN MODIFICAR de M1, M4 y M6.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

// Lo mínimo de Supabase que las migraciones esperan (roles anon/authenticated, schema auth, auth.uid()).
const BASE_SUPABASE = `
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text unique not null, raw_user_meta_data jsonb default '{}');
create table auth.credenciales (usuario_id uuid primary key references auth.users(id) on delete cascade, clave_hash text not null);
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated;
create table public._migraciones (nombre text primary key, aplicada_en timestamptz default now());
`;

export async function abrirBD(dir) {
  if (dir !== 'memory://') mkdirSync(dir, { recursive: true });
  const db = new PGlite(dir);
  await db.waitReady;
  const { rows } = await db.query(`select to_regclass('public._migraciones') as t`);
  if (!rows[0].t) await db.exec(BASE_SUPABASE);
  const hechas = new Set((await db.query('select nombre from public._migraciones')).rows.map(r => r.nombre));
  const dirMig = join(RAIZ, 'supabase', 'migrations');
  for (const f of readdirSync(dirMig).filter(x => x.endsWith('.sql')).sort()) {
    if (hechas.has(f)) continue;
    await db.exec(readFileSync(join(dirMig, f), 'utf8'));
    await db.query('insert into public._migraciones(nombre) values ($1)', [f]);
    console.log('  migración aplicada:', f);
  }
  return db;
}
