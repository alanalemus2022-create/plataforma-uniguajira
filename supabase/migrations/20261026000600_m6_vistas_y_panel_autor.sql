-- M6 · 0004_vistas_y_panel_autor
-- Visualizaciones (RF-25) sin datos personales + panel del autor.
-- Definición de "vista válida" (PROPUESTA): un visitante (token aleatorio del
-- navegador, guardado solo como hash SHA-256) cuenta una vez por simulación y día (UTC).
-- Contrato con M4: llamar public.registrar_vista(simulacion_id, token) al abrir la página.

create table public.vistas_simulacion (
  id             bigint generated always as identity primary key,
  simulacion_id  uuid not null references public.simulaciones(id) on delete cascade,
  visitante_hash text not null check (char_length(visitante_hash) = 64),
  dia            date not null default ((now() at time zone 'utc')::date),
  unique (simulacion_id, visitante_hash, dia)
);

alter table public.vistas_simulacion enable row level security;
revoke all on public.vistas_simulacion from anon, authenticated;   -- sin políticas: acceso solo vía función

create or replace function public.registrar_vista(p_simulacion_id uuid, p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare filas int;
begin
  if p_token is null or char_length(p_token) < 16 or char_length(p_token) > 128 then
    return false;
  end if;
  if not public.simulacion_es_publica(p_simulacion_id) then
    return false;
  end if;
  insert into public.vistas_simulacion (simulacion_id, visitante_hash)
  values (p_simulacion_id, encode(sha256(convert_to(p_token, 'UTF8')), 'hex'))
  on conflict do nothing;
  get diagnostics filas = row_count;
  return filas = 1;
end;
$$;
revoke all on function public.registrar_vista(uuid, text) from public;
grant execute on function public.registrar_vista(uuid, text) to anon, authenticated;

-- Panel del autor: solo las simulaciones del usuario autenticado.
create or replace function public.panel_autor()
returns table (simulacion_id uuid, estado text, vistas int, promedio numeric, total_valoraciones int)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id,
         s.estado,
         (select count(*)::int from public.vistas_simulacion v where v.simulacion_id = s.id),
         (select round(avg(x.puntaje)::numeric, 2) from public.valoraciones x where x.simulacion_id = s.id),
         (select count(*)::int from public.valoraciones x where x.simulacion_id = s.id)
  from public.simulaciones s
  where s.autor_id = auth.uid();
$$;
revoke all on function public.panel_autor() from public;
grant execute on function public.panel_autor() to authenticated;
