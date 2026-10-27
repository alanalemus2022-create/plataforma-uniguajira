-- Pruebas de m4_0001 (ESCRITAS, NO EJECUTADAS: no había PostgreSQL al redactarlas). Usa las tablas REALES de M1.
-- Cada verificación lanza una excepción si falla; con ON_ERROR_STOP el script se detiene en la primera.
\set ON_ERROR_STOP on
create schema pruebas; grant usage on schema pruebas to public;
create function pruebas.como(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', u, false) $$;
create function pruebas.cuenta(q text) returns bigint language plpgsql as $$ declare n bigint; begin execute 'select count(*) from ('||q||') x' into n; return n; end $$;
create function pruebas.esperar(q text, n bigint, msg text) returns void language plpgsql as $$
begin if pruebas.cuenta(q) <> n then raise exception 'FALLO: % (esperado %, obtenido %)', msg, n, pruebas.cuenta(q); end if; end $$;
create function pruebas.falla(sentencia text, codigo text) returns void language plpgsql as $$
begin
  begin execute sentencia; exception when others then
    if sqlstate = codigo then return; end if;
    raise exception 'Código distinto al esperado (% vs %): %', sqlstate, codigo, sqlerrm;
  end;
  raise exception 'Debió fallar: %', sentencia;
end $$;
grant execute on all functions in schema pruebas to public;

insert into auth.users(id,email) values
  ('aaaaaaaa-0000-0000-0000-000000000001','ana@x.co'), ('aaaaaaaa-0000-0000-0000-000000000002','bob@x.co'),
  ('aaaaaaaa-0000-0000-0000-000000000003','mod@x.co'), ('aaaaaaaa-0000-0000-0000-000000000004','adm@x.co');
update public.perfiles set rol='moderador'     where correo='mod@x.co';
update public.perfiles set rol='administrador' where correo='adm@x.co';

-- T1 Ana crea una simulación aislada → borrador. No puede fijar estado.
select pruebas.como('aaaaaaaa-0000-0000-0000-000000000001'); set role authenticated;
insert into public.simulaciones(autor_id,clave,nombre,tipo,runtime,punto_entrada)
  values ('aaaaaaaa-0000-0000-0000-000000000001','contador-demo','Contador demo','simulador','aislada','https://x.co/c.html');
select pruebas.falla($q$insert into public.simulaciones(autor_id,clave,nombre,tipo,runtime,punto_entrada,estado)
  values ('aaaaaaaa-0000-0000-0000-000000000001','otra-demo','Otra demo','simulador','aislada','https://x.co/a.html','publicada')$q$, '42501');
-- T2 No a nombre de otro; 'integrada' solo admin; URL debe ser https.
select pruebas.falla($q$insert into public.simulaciones(autor_id,clave,nombre,tipo,runtime,punto_entrada)
  values ('aaaaaaaa-0000-0000-0000-000000000002','suplanta','Suplantación','otro','aislada','https://x.co/a.html')$q$, '42501');
select pruebas.falla($q$insert into public.simulaciones(autor_id,clave,nombre,tipo,runtime,punto_entrada)
  values ('aaaaaaaa-0000-0000-0000-000000000001','integrada-no','Integrada no','otro','integrada','arboles-avl')$q$, '42501');
select pruebas.falla($q$insert into public.simulaciones(autor_id,clave,nombre,tipo,runtime,punto_entrada)
  values ('aaaaaaaa-0000-0000-0000-000000000001','url-mala','URL mala','otro','aislada','http://x.co/a.html')$q$, '23514');
-- T3 Visibilidad del borrador: Ana sí, Bob no, moderador sí, anon no.
select pruebas.esperar('select 1 from public.simulaciones', 1, 'Ana ve su borrador');
reset role; select pruebas.como('aaaaaaaa-0000-0000-0000-000000000002'); set role authenticated;
select pruebas.esperar('select 1 from public.simulaciones', 0, 'Bob no ve borradores ajenos');
reset role; select pruebas.como('aaaaaaaa-0000-0000-0000-000000000003'); set role authenticated;
select pruebas.esperar('select 1 from public.simulaciones', 1, 'El moderador ve todo');
reset role; select pruebas.como(''); set role anon;
select pruebas.esperar('select 1 from public.simulaciones', 0, 'anon no ve borradores');
-- T4 Publicada (lo haría M5) → visible para anon.
reset role; update public.simulaciones set estado='publicada' where clave='contador-demo';
set role anon;
select pruebas.esperar('select 1 from public.simulaciones', 1, 'anon ve publicadas');
-- T5 Clientes sin UPDATE/DELETE (los agrega M5).
reset role; select pruebas.como('aaaaaaaa-0000-0000-0000-000000000001'); set role authenticated;
select pruebas.falla($q$update public.simulaciones set nombre='Hack' where clave='contador-demo'$q$, '42501');
select pruebas.falla($q$delete from public.simulaciones where clave='contador-demo'$q$, '42501');
-- T6 Configuraciones: Bob guarda una compartida y una privada; Ana abre solo la compartida por id.
reset role; select pruebas.como('aaaaaaaa-0000-0000-0000-000000000002'); set role authenticated;
insert into public.simulacion_configuraciones(id,simulacion_id,usuario_id,nombre,estado,compartida)
  select 'bbbbbbbb-0000-0000-0000-000000000001', id, 'aaaaaaaa-0000-0000-0000-000000000002', 'Compartida', '{"version":1}', true from public.simulaciones where clave='contador-demo';
insert into public.simulacion_configuraciones(id,simulacion_id,usuario_id,nombre,estado,compartida)
  select 'bbbbbbbb-0000-0000-0000-000000000002', id, 'aaaaaaaa-0000-0000-0000-000000000002', 'Privada', '{"version":1}', false from public.simulaciones where clave='contador-demo';
reset role; select pruebas.como('aaaaaaaa-0000-0000-0000-000000000001'); set role authenticated;
select pruebas.esperar('select 1 from public.simulacion_configuraciones', 0, 'Ana no lista configs de Bob');
select pruebas.esperar($q$select 1 from public.obtener_configuracion('bbbbbbbb-0000-0000-0000-000000000001')$q$, 1, 'Ana abre la compartida');
select pruebas.esperar($q$select 1 from public.obtener_configuracion('bbbbbbbb-0000-0000-0000-000000000002')$q$, 0, 'Ana no abre la privada');
select pruebas.falla($q$insert into public.simulacion_configuraciones(simulacion_id,usuario_id,nombre,estado)
  select id,'aaaaaaaa-0000-0000-0000-000000000002','Suplanta','{}' from public.simulaciones$q$, '42501');
reset role;
\echo 'OK: pruebas SQL de M4 completadas (T1–T6)'
