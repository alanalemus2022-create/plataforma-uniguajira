-- M6 · 0003_comentarios
-- Comentarios sobre simulaciones (RF-23). Propiedad: M6.
-- DEPENDENCIA M1 (provisional): public.es_moderador() returns boolean.
-- La denuncia/moderación de contenido (RF-24) pertenece a M5: aquí solo se
-- permite que un moderador oculte (borrado lógico) un comentario.

create table public.comentarios (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references public.perfiles(id)     on delete cascade,
  simulacion_id uuid not null references public.simulaciones(id) on delete cascade,
  contenido     text not null check (char_length(btrim(contenido)) between 1 and 1000),
  creado_en     timestamptz not null default now(),
  editado_en    timestamptz,
  eliminado_en  timestamptz
);

create index comentarios_simulacion_creado_idx
  on public.comentarios (simulacion_id, creado_en desc);

create or replace function public.comentarios_antes_de_actualizar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id <> old.id or new.usuario_id <> old.usuario_id
     or new.simulacion_id <> old.simulacion_id or new.creado_en <> old.creado_en then
    raise exception 'Campos inmutables del comentario' using errcode = 'check_violation';
  end if;
  if old.eliminado_en is not null then
    raise exception 'El comentario ya fue eliminado' using errcode = 'check_violation';
  end if;
  if new.contenido is distinct from old.contenido then
    if old.usuario_id is distinct from auth.uid() then
      raise exception 'Solo el autor puede editar el contenido' using errcode = 'check_violation';
    end if;
    new.editado_en := now();
  end if;
  return new;
end;
$$;

create trigger comentarios_bu
  before update on public.comentarios
  for each row execute function public.comentarios_antes_de_actualizar();

alter table public.comentarios enable row level security;

revoke all on public.comentarios from anon, authenticated;
grant select on public.comentarios to anon, authenticated;
grant insert on public.comentarios to authenticated;
-- Sin DELETE: el borrado es lógico (eliminado_en). Solo se pueden tocar 2 columnas.
grant update (contenido, eliminado_en) on public.comentarios to authenticated;

create policy comentarios_select_publicos on public.comentarios
  for select to anon, authenticated
  using (eliminado_en is null and public.simulacion_es_publica(simulacion_id));

-- Necesaria para que el borrado lógico (UPDATE) pase la verificación de RLS:
-- el autor y los moderadores pueden ver también los comentarios ocultos.
create policy comentarios_select_autor_o_moderador on public.comentarios
  for select to authenticated
  using (usuario_id = auth.uid() or public.es_moderador());

create policy comentarios_insert_propios on public.comentarios
  for insert to authenticated
  with check (usuario_id = auth.uid()
              and eliminado_en is null
              and public.simulacion_es_publica(simulacion_id));

create policy comentarios_update_autor_o_moderador on public.comentarios
  for update to authenticated
  using (usuario_id = auth.uid() or public.es_moderador())
  with check (usuario_id = auth.uid() or public.es_moderador());
