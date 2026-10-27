-- M6 · 0001_favoritos
-- Favoritos / lista personal de estudio (RF-22). Propiedad: M6.
-- PROVISIONAL: depende de public.perfiles(id uuid) [M1] y
-- public.simulaciones(id uuid, autor_id uuid, estado text) [M4/M5].
-- PROVISIONAL: se asume que el estado 'publicada' (RF-17) identifica
-- simulaciones visibles; debe confirmarlo M5.

-- Helper compartido con 0002/0003: ¿la simulación es pública?
-- SECURITY DEFINER para no depender de las políticas RLS de M4/M5.
create or replace function public.simulacion_es_publica(p_simulacion_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.simulaciones s
    where s.id = p_simulacion_id and s.estado = 'publicada'
  );
$$;
revoke all on function public.simulacion_es_publica(uuid) from public;
grant execute on function public.simulacion_es_publica(uuid) to anon, authenticated;

create table public.favoritos (
  usuario_id    uuid not null references public.perfiles(id)      on delete cascade,
  simulacion_id uuid not null references public.simulaciones(id)  on delete cascade,
  creado_en     timestamptz not null default now(),
  primary key (usuario_id, simulacion_id)   -- evita duplicados
);

create index favoritos_usuario_creado_idx
  on public.favoritos (usuario_id, creado_en desc);

alter table public.favoritos enable row level security;

revoke all on public.favoritos from anon, authenticated;
grant select, insert, delete on public.favoritos to authenticated;

create policy favoritos_select_propios on public.favoritos
  for select to authenticated
  using (usuario_id = auth.uid());

create policy favoritos_insert_propios on public.favoritos
  for insert to authenticated
  with check (usuario_id = auth.uid()
              and public.simulacion_es_publica(simulacion_id));

create policy favoritos_delete_propios on public.favoritos
  for delete to authenticated
  using (usuario_id = auth.uid());
