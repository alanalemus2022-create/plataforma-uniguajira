-- M1 · Cuentas, roles y seguridad · Plataforma de Simulaciones Uniguajira
-- Migración 0001 (versión 0.1). NO PROBADA contra PostgreSQL/Supabase todavía.
-- Roles con sesión: estudiante, profesor, moderador, administrador.
-- "visitante" = sin sesión (rol de BD `anon`); no tiene fila en perfiles.

-- 1. Perfiles ---------------------------------------------------------------
create table public.perfiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text not null default '' check (char_length(nombre_completo) <= 120),
  correo          text not null,
  rol             text not null default 'estudiante'
                  check (rol in ('estudiante','profesor','moderador','administrador')),
  carrera_id      uuid,          -- FK a public.carreras(id) la agrega M2 en su migración
  semestre        smallint check (semestre between 1 and 12),
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

create table public.cambios_rol (
  id          bigint generated always as identity primary key,
  usuario_id  uuid not null references public.perfiles(id) on delete cascade,
  rol_antes   text not null,
  rol_nuevo   text not null,
  hecho_por   uuid references public.perfiles(id) on delete set null,
  motivo      text,
  creado_en   timestamptz not null default now()
);

-- 2. Funciones de permisos (SECURITY DEFINER para no caer en recursión de RLS)
create or replace function public.rol_actual() returns text
language sql stable security definer set search_path = public, pg_temp as
$$ select rol from public.perfiles where id = auth.uid() $$;

create or replace function public.es_administrador() returns boolean
language sql stable security definer set search_path = public, pg_temp as
$$ select coalesce(public.rol_actual() = 'administrador', false) $$;

-- Contrato con M6: moderador O administrador.
create or replace function public.es_moderador() returns boolean
language sql stable security definer set search_path = public, pg_temp as
$$ select coalesce(public.rol_actual() in ('moderador','administrador'), false) $$;

-- Profesor O administrador (para destacar simulaciones oficiales, RF-21).
create or replace function public.es_profesor() returns boolean
language sql stable security definer set search_path = public, pg_temp as
$$ select coalesce(public.rol_actual() in ('profesor','administrador'), false) $$;

grant execute on function public.rol_actual(), public.es_administrador(),
  public.es_moderador(), public.es_profesor() to anon, authenticated;

-- 3. Alta automática de perfil al registrarse -------------------------------
-- El rol SIEMPRE nace como 'estudiante'; nunca se toma de metadatos del cliente.
create or replace function public.crear_perfil_al_registrarse() returns trigger
language plpgsql security definer set search_path = public, pg_temp as
$$
begin
  insert into public.perfiles (id, correo, nombre_completo)
  values (new.id, new.email,
          left(coalesce(new.raw_user_meta_data->>'nombre_completo', ''), 120));
  return new;
end $$;

create trigger trg_crear_perfil
  after insert on auth.users
  for each row execute function public.crear_perfil_al_registrarse();

-- 4. Mantener actualizado_en --------------------------------------------------
create or replace function public.tocar_actualizado_en() returns trigger
language plpgsql as $$ begin new.actualizado_en := now(); return new; end $$;

create trigger trg_perfiles_actualizado
  before update on public.perfiles
  for each row execute function public.tocar_actualizado_en();

-- 5. Cambio de rol: única vía, solo administrador, con auditoría ---------------
create or replace function public.asignar_rol(p_usuario uuid, p_rol text, p_motivo text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as
$$
declare v_antes text;
begin
  if not public.es_administrador() then
    raise exception 'Solo un administrador puede asignar roles' using errcode = '42501';
  end if;
  if p_usuario = auth.uid() then
    raise exception 'No puedes cambiar tu propio rol' using errcode = '42501';
  end if;
  if p_rol not in ('estudiante','profesor','moderador','administrador') then
    raise exception 'Rol inválido: %', p_rol using errcode = '22023';
  end if;
  select rol into v_antes from public.perfiles where id = p_usuario for update;
  if v_antes is null then
    raise exception 'Usuario no encontrado' using errcode = 'P0002';
  end if;
  update public.perfiles set rol = p_rol where id = p_usuario;
  insert into public.cambios_rol (usuario_id, rol_antes, rol_nuevo, hecho_por, motivo)
  values (p_usuario, v_antes, p_rol, auth.uid(), p_motivo);
end $$;

revoke all on function public.asignar_rol(uuid, text, text) from public, anon;
grant execute on function public.asignar_rol(uuid, text, text) to authenticated;

-- 6. RLS ----------------------------------------------------------------------
alter table public.perfiles    enable row level security;
alter table public.cambios_rol enable row level security;

-- Cada usuario ve su perfil; el administrador ve todos.
create policy perfiles_select_propio_o_admin on public.perfiles
  for select to authenticated
  using (id = auth.uid() or public.es_administrador());

-- Cada usuario edita solo su perfil y SOLO estas columnas (ver GRANT abajo).
create policy perfiles_update_propio on public.perfiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

revoke all on public.perfiles from anon, authenticated;
grant select on public.perfiles to authenticated;
grant update (nombre_completo, carrera_id, semestre) on public.perfiles to authenticated;
-- INSERT/DELETE no se otorgan: el perfil lo crea el trigger y se borra en cascada.

-- Auditoría: solo administrador lee; nadie escribe directo (solo asignar_rol).
create policy cambios_rol_select_admin on public.cambios_rol
  for select to authenticated using (public.es_administrador());
revoke all on public.cambios_rol from anon, authenticated;
grant select on public.cambios_rol to authenticated;

-- 7. Vista pública mínima (para mostrar el autor en comentarios, M6) ----------
-- Expone solo id y nombre; nunca correo, rol, carrera ni semestre.
create view public.perfiles_publicos as
  select id, nombre_completo from public.perfiles;   -- corre con permisos del dueño
grant select on public.perfiles_publicos to anon, authenticated;

-- 8. Primer administrador (EJECUTAR A MANO una sola vez, no en la migración):
--   update public.perfiles set rol = 'administrador' where correo = '<correo del admin inicial>';
