import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../cliente.js';
// M6 (interfaz, aplazada en su informe): favoritos (RF-22), valoraciones y comentarios (RF-23) sobre sus tablas.
// Lee promedio/total de valoraciones_resumen; nombres de autores desde perfiles_publicos (M1).
export default function Comunidad({ clave, uid, perfil }) {
  const [sim, setSim] = useState(null), [fav, setFav] = useState(false), [mia, setMia] = useState(0), [res, setRes] = useState(null);
  const [coms, setComs] = useState([]), [nombres, setNombres] = useState({}), [txt, setTxt] = useState(''), [msg, setMsg] = useState('');
  const cargar = useCallback(async () => {
    const { data: s } = await supabase.from('simulaciones').select('id, autor_id').eq('clave', clave).maybeSingle();
    if (!s) return; setSim(s);
    const { data: r } = await supabase.from('valoraciones_resumen').select('promedio, total').eq('simulacion_id', s.id).maybeSingle(); setRes(r);
    const { data: c } = await supabase.from('comentarios').select('id, usuario_id, contenido, creado_en, eliminado_en').eq('simulacion_id', s.id).order('creado_en', { ascending: false });
    const vis = (c || []).filter(x => !x.eliminado_en); setComs(vis);
    const { data: p } = await supabase.from('perfiles_publicos').select('id, nombre_completo');
    setNombres(Object.fromEntries((p || []).map(x => [x.id, x.nombre_completo])));
    if (uid) {
      const { data: f } = await supabase.from('favoritos').select('simulacion_id').eq('simulacion_id', s.id).eq('usuario_id', uid).maybeSingle(); setFav(!!f);
      const { data: v } = await supabase.from('valoraciones').select('puntaje').eq('simulacion_id', s.id).eq('usuario_id', uid).maybeSingle(); setMia(v?.puntaje || 0);
    }
  }, [clave, uid]);
  useEffect(() => { cargar(); }, [cargar]);
  if (!sim) return null;
  const avisar = (e, ok) => setMsg(e ? (e.message || 'No se pudo completar la acción') : ok || '');
  const alternarFav = async () => { const { error } = fav ? await supabase.from('favoritos').delete().eq('simulacion_id', sim.id).eq('usuario_id', uid) : await supabase.from('favoritos').insert({ simulacion_id: sim.id, usuario_id: uid }); avisar(error); cargar(); };
  const valorar = async n => { const { error } = await supabase.from('valoraciones').upsert({ simulacion_id: sim.id, usuario_id: uid, puntaje: n }, { onConflict: 'usuario_id,simulacion_id' }); avisar(error && (/propia|autor/i.test(error.message) ? { message: 'No puedes valorar tu propia simulación' } : error)); cargar(); };
  const comentar = async e => { e.preventDefault(); const { error } = await supabase.from('comentarios').insert({ simulacion_id: sim.id, usuario_id: uid, contenido: txt.trim() }); avisar(error); if (!error) setTxt(''); cargar(); };
  const ocultar = async id => { const { error } = await supabase.from('comentarios').update({ eliminado_en: new Date().toISOString() }).eq('id', id); avisar(error); cargar(); };
  const moderador = perfil && ['moderador', 'administrador'].includes(perfil.rol);
  return (
    <section className="tarjeta" aria-labelledby="com">
      <h2 id="com">Comunidad</h2>
      <p>{res ? `Valoración: ★ ${Number(res.promedio).toFixed(1)} (${res.total})` : 'Aún sin valoraciones'}</p>
      {uid ? (
        <>
          <div className="estrellas" role="group" aria-label="Tu valoración">
            {[1, 2, 3, 4, 5].map(n => <button key={n} className={n <= mia ? 'activa' : ''} aria-label={`${n} estrellas`} onClick={() => valorar(n)}>★</button>)}
            <button onClick={alternarFav} aria-pressed={fav}>{fav ? '♥ En favoritos' : '♡ Guardar en favoritos'}</button>
          </div>
          <form onSubmit={comentar} className="formulario" style={{ maxWidth: '100%', marginTop: '.75rem' }}>
            <label>Comentario<textarea required maxLength={1000} rows={3} value={txt} onChange={e => setTxt(e.target.value)} /></label>
            <button className="primario" disabled={!txt.trim()}>Publicar comentario</button>
          </form>
        </>) : <p><a href="#/acceso">Ingresa</a> para valorar, guardar y comentar.</p>}
      {msg && <p role="status" className="tenue">{msg}</p>}
      {coms.length === 0 ? <p className="tenue">Todavía no hay comentarios.</p> : coms.map(c => (
        <div key={c.id} className="tarjeta">
          <strong>{nombres[c.usuario_id] || 'Usuario'}</strong> <span className="tenue">{new Date(c.creado_en).toLocaleString()}</span>
          <p style={{ whiteSpace: 'pre-wrap' }}>{c.contenido}</p>
          {(c.usuario_id === uid || moderador) && <button onClick={() => ocultar(c.id)}>Eliminar</button>}
        </div>))}
    </section>);
}
