// M4 · Acceso a datos desde el navegador. Recibe el cliente de Supabase ya creado (clave pública anon + sesión).
// NUNCA usar service_role aquí. M1 crea el cliente; M4 solo lo consume.
import { obtenerTokenVisitante } from '../nucleo/token.js';

const COLUMNAS = 'id, autor_id, clave, nombre, descripcion, instrucciones, teoria, tipo, runtime, punto_entrada, contrato_version, manifiesto, estado';

/** Devuelve la fila o null (no existe / no publicada y no es del usuario / sin permiso). */
export async function cargarSimulacionPorClave(supabase, clave) {
  const { data, error } = await supabase.from('simulaciones').select(COLUMNAS).eq('clave', clave).maybeSingle();
  if (error) throw new Error('No se pudo cargar la simulación');
  return data;
}

/** Contrato con M6: registrar_vista al abrir la página. Un fallo aquí nunca debe romper la página. */
export async function registrarVista(supabase, simulacionId) {
  try {
    const { data } = await supabase.rpc('registrar_vista', { p_simulacion_id: simulacionId, p_token: obtenerTokenVisitante() });
    return data === true;
  } catch { return false; }
}

export async function guardarConfiguracion(supabase, { simulacionId, usuarioId, nombre, estado, compartida = false }) {
  const { data, error } = await supabase.from('simulacion_configuraciones')
    .insert({ simulacion_id: simulacionId, usuario_id: usuarioId, nombre, estado, compartida }).select('id').single();
  if (error) throw new Error('No se pudo guardar la configuración');
  return data.id;
}

export async function obtenerConfiguracion(supabase, id) {
  const { data, error } = await supabase.rpc('obtener_configuracion', { p_id: id });
  if (error) throw new Error('No se pudo cargar la configuración');
  return data?.[0] ?? null;
}
