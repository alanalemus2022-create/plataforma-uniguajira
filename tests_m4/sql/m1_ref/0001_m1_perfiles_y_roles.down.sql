-- Reversa de M1 0001. ATENCIÓN: las migraciones de M6 dependen de perfiles y es_moderador();
-- revertir primero las de M6 (0004 → 0001) si ya fueron aplicadas.
drop view     if exists public.perfiles_publicos;
drop trigger  if exists trg_crear_perfil on auth.users;
drop function if exists public.crear_perfil_al_registrarse();
drop function if exists public.asignar_rol(uuid, text, text);
drop table    if exists public.cambios_rol;
drop table    if exists public.perfiles;
drop function if exists public.tocar_actualizado_en();
drop function if exists public.es_profesor();
drop function if exists public.es_moderador();
drop function if exists public.es_administrador();
drop function if exists public.rol_actual();
