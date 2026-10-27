-- M4 · 20261026000200_m4_simulaciones (Adaptado para integración con React)
-- Crea el registro común de simulaciones y las configuraciones guardadas.

create table public.simulaciones (
  id               uuid primary key default gen_random_uuid(),
  autor_id         uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  clave            text not null unique default gen_random_uuid()::text
                   check (clave ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(clave) between 3 and 60),
  nombre           text not null check (char_length(btrim(nombre)) between 3 and 120),
  descripcion      text not null default '' check (char_length(descripcion) <= 500),
  instrucciones    text not null default '' check (char_length(instrucciones) <= 5000),
  teoria           text not null default '' check (char_length(teoria) <= 20000),
  tipo             text not null default 'simulador' check (tipo in ('visualizador','simulador','ejercicio','otro')),
  runtime          text not null default 'aislada' check (runtime in ('integrada','aislada')),
  url              text not null, -- Renombrado desde punto_entrada para coincidir con tu app React
  imagen           text,          -- Nueva columna para la portada
  creadores        text,          -- Nueva columna para la autoría en texto
  contrato_version smallint not null default 1 check (contrato_version = 1),
  manifiesto       jsonb not null default '{}'::jsonb
                   check (jsonb_typeof(manifiesto) = 'object' and octet_length(manifiesto::text) <= 65536),
  estado           text not null default 'publicada' -- Por defecto 'publicada' para que aparezcan en el catálogo de inmediato
                   check (estado in ('borrador','en_revision','publicada','rechazada','retirada')),
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now()
);

create index simulaciones_autor_idx  on public.simulaciones (autor_id);
create index simulaciones_estado_idx on public.simulaciones (estado, creado_en desc);
create index simulaciones_tipo_idx   on public.simulaciones (tipo) where estado = 'publicada';

create trigger trg_simulaciones_actualizado
  before update on public.simulaciones
  for each row execute function public.tocar_actualizado_en();

alter table public.simulaciones enable row level security;
revoke all on public.simulaciones from anon, authenticated;

-- Permisos de lectura
grant select on public.simulaciones to anon, authenticated;

-- Permisos de Inserción, Actualización y Eliminación (Adaptados para el frontend)
grant insert (autor_id, clave, nombre, descripcion, instrucciones, teoria, tipo, runtime, url, imagen, creadores, contrato_version, manifiesto, estado)
  on public.simulaciones to authenticated;
grant update (nombre, descripcion, url, imagen, creadores) on public.simulaciones to authenticated;
grant delete on public.simulaciones to authenticated;

-- Políticas de Lectura
create policy simulaciones_select_publicadas on public.simulaciones
  for select to anon, authenticated using (estado = 'publicada');
create policy simulaciones_select_propias on public.simulaciones
  for select to authenticated using (autor_id = auth.uid());
create policy simulaciones_select_moderacion on public.simulaciones
  for select to authenticated using (public.es_moderador());

-- Políticas de Creación, Actualización y Eliminación (Para que funcionen los botones de gestión)
create policy simulaciones_insert_propias on public.simulaciones
  for insert to authenticated
  with check (autor_id = auth.uid());

create policy simulaciones_update_propias on public.simulaciones
  for update to authenticated
  using (autor_id = auth.uid());

create policy simulaciones_delete_propias on public.simulaciones
  for delete to authenticated
  using (autor_id = auth.uid());

-- RF-15 · Configuraciones guardadas ----------------------------------------------------------------------------
create table public.simulacion_configuraciones (
  id            uuid primary key default gen_random_uuid(),
  simulacion_id uuid not null references public.simulaciones(id) on delete cascade,
  usuario_id    uuid not null references public.perfiles(id)    on delete cascade,
  nombre        text not null check (char_length(btrim(nombre)) between 1 and 80),
  estado        jsonb not null check (jsonb_typeof(estado) = 'object' and octet_length(estado::text) <= 16384),
  compartida    boolean not null default false,
  creado_en     timestamptz not null default now()
);
create index simulacion_config_usuario_idx on public.simulacion_configuraciones (usuario_id, simulacion_id, creado_en desc);

create or replace function public.limitar_configuraciones() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.simulacion_configuraciones
      where usuario_id = new.usuario_id and simulacion_id = new.simulacion_id) >= 20 then
    raise exception 'Máximo 20 configuraciones por simulación' using errcode = '54000';
  end if;
  return new;
end $$;
create trigger trg_limitar_configuraciones before insert on public.simulacion_configuraciones
  for each row execute function public.limitar_configuraciones();

alter table public.simulacion_configuraciones enable row level security;
revoke all on public.simulacion_configuraciones from anon, authenticated;
grant select, insert, delete on public.simulacion_configuraciones to authenticated;
grant update (nombre, compartida) on public.simulacion_configuraciones to authenticated;

create policy config_select_propias on public.simulacion_configuraciones
  for select to authenticated using (usuario_id = auth.uid());
create policy config_insert_propias on public.simulacion_configuraciones
  for insert to authenticated
  with check (usuario_id = auth.uid()
              and exists (select 1 from public.simulaciones s where s.id = simulacion_id and s.estado = 'publicada'));
create policy config_update_propias on public.simulacion_configuraciones
  for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy config_delete_propias on public.simulacion_configuraciones
  for delete to authenticated using (usuario_id = auth.uid());

create or replace function public.obtener_configuracion(p_id uuid)
returns table (id uuid, simulacion_id uuid, nombre text, estado jsonb, compartida boolean, es_propia boolean)
language sql stable security definer set search_path = '' as $$
  select c.id, c.simulacion_id, c.nombre, c.estado, c.compartida, (c.usuario_id = auth.uid())
  from public.simulacion_configuraciones c
  where c.id = p_id
    and (c.usuario_id = auth.uid()
         or (c.compartida and exists (select 1 from public.simulaciones s where s.id = c.simulacion_id and s.estado = 'publicada')));
$$;
revoke all on function public.obtener_configuracion(uuid) from public;
grant execute on function public.obtener_configuracion(uuid) to anon, authenticated;