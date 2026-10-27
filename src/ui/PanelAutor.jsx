import { useEffect, useState } from 'react';
import { supabase } from '../cliente.js';
// M6 RF-25: panel del autor sobre la función panel_autor(); y lista de estudio (favoritos, RF-22).
export default function PanelAutor() {
  const [filas, setFilas] = useState(null), [favs, setFavs] = useState(null), [err, setErr] = useState('');
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc('panel_autor'); if (error) return setErr('No se pudo cargar el panel');
      const { data: f } = await supabase.from('favoritos').select('simulacion_id').order('creado_en', { ascending: false });
      const ids = (f || []).map(x => x.simulacion_id);
      const { data: sims } = await supabase.from('simulaciones').select('id, clave, nombre').eq('estado', 'publicada');
      const mapa = Object.fromEntries((sims || []).map(s => [s.id, s]));
      setFavs(ids.map(i => mapa[i]).filter(Boolean));
      const nombres = Object.fromEntries((sims || []).map(s => [s.id, s.nombre]));
      const { data: mias } = await supabase.from('simulaciones').select('id, nombre');
      (mias || []).forEach(s => (nombres[s.id] = s.nombre));
      setFilas(data.map(r => ({ ...r, nombre: nombres[r.simulacion_id] || r.simulacion_id })));
    })();
  }, []);
  if (err) return <p role="alert" className="error">{err}</p>;
  if (!filas) return <p role="status">Cargando…</p>;
  return (
    <>
      <h1>Panel del autor</h1>
      {filas.length === 0 ? <p>Aún no has creado simulaciones. (La creación y publicación por la comunidad es el módulo M5, pendiente.)</p> :
        <div className="tarjeta" style={{ overflowX: 'auto' }}><table><thead><tr><th>Simulación</th><th>Estado</th><th>Vistas</th><th>Promedio</th><th>Valoraciones</th></tr></thead>
          <tbody>{filas.map(r => <tr key={r.simulacion_id}><td>{r.nombre}</td><td>{r.estado}</td><td>{r.vistas}</td><td>{r.promedio ?? '—'}</td><td>{r.total_valoraciones}</td></tr>)}</tbody></table></div>}
      <h2>Mi lista de estudio</h2>
      {favs?.length ? <ul>{favs.map(s => <li key={s.id}><a href={`#/simulacion/${s.clave}`}>{s.nombre}</a></li>)}</ul> : <p className="tenue">No tienes favoritos todavía.</p>}
    </>);
}
