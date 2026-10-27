-- M6 · 0002_valoraciones
-- Valoraciones 1–5 (RF-23). Escala = PROPUESTA pendiente de aprobación.
-- Una valoración por usuario y simulación; editable.
-- Las filas individuales son privadas: el público solo ve el resumen.

create table public.valoraciones (
  usuario_id     uuid not null references public.perfiles(id)     on delete cascade,
  simulacion_id  uuid not null references public.simulaciones(id) on delete cascade,
  puntaje        smallint not null check (puntaje between 1 and 5),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  primary key (usuario_id, simulacion_id)
);

create index valoraciones_simulacion_idx on public.valoraciones (simulacion_id);

-- Integridad en BD: el autor no valora su propia simulación; las claves no
-- cambian en UPDATE; se actualiza la marca de tiempo.
create or replace function public.valoraciones_antes_de_escribir()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.simulaciones s
             where s.id = new.simulacion_id and s.autor_id = new.usuario_id) then
    raise exception 'El autor no puede valorar su propia simulación'
      using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' then
    if new.usuario_id <> old.usuario_id or new.simulacion_id <> old.simulacion_id then
      raise exception 'No se pueden cambiar usuario ni simulación de una valoración'
        using errcode = 'check_violation';
    end if;
    new.creado_en := old.creado_en;
    new.actualizado_en := now();
  end if;
  return new;
end;
$$;

create trigger valoraciones_bi_bu
  before insert or update on public.valoraciones
  for each row execute function public.valoraciones_antes_de_escribir();

alter table public.valoraciones enable row level security;

revoke all on public.valoraciones from anon, authenticated;
grant select, insert, update, delete on public.valoraciones to authenticated;

create policy valoraciones_select_propias on public.valoraciones
  for select to authenticated
  using (usuario_id = auth.uid());

create policy valoraciones_insert_propias on public.valoraciones
  for insert to authenticated
  with check (usuario_id = auth.uid()
              and public.simulacion_es_publica(simulacion_id));

create policy valoraciones_update_propias on public.valoraciones
  for update to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid()
              and public.simulacion_es_publica(simulacion_id));

create policy valoraciones_delete_propias on public.valoraciones
  for delete to authenticated
  using (usuario_id = auth.uid());

-- Resumen público (promedio y conteo). La vista corre con los privilegios de
-- su dueño (sin security_invoker) para agregar sin exponer filas individuales.
create view public.valoraciones_resumen as
select v.simulacion_id,
       round(avg(v.puntaje)::numeric, 2) as promedio,
       count(*)::int                     as total
from public.valoraciones v
where public.simulacion_es_publica(v.simulacion_id)
group by v.simulacion_id;

revoke all on public.valoraciones_resumen from public;
grant select on public.valoraciones_resumen to anon, authenticated;
