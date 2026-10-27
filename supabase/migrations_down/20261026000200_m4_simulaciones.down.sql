-- Reversa de m4_0001. Revertir ANTES las migraciones de M6 (dependen de public.simulaciones).
drop function if exists public.obtener_configuracion(uuid);
drop table if exists public.simulacion_configuraciones;
drop function if exists public.limitar_configuraciones();
drop table if exists public.simulaciones;
