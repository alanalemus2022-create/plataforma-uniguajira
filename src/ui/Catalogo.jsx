import { useState, useEffect } from 'react';
import { supabase } from '../cliente.js'; // Conexión a tu BD
import './app.css';

export default function Catalogo() {
  const [temaOscuro, setTemaOscuro] = useState(() => localStorage.getItem('tema') === 'oscuro');

  useEffect(() => {
    if (temaOscuro) {
      document.body.classList.add('tema-oscuro');
      localStorage.setItem('tema', 'oscuro');
    } else {
      document.body.classList.remove('tema-oscuro');
      localStorage.setItem('tema', 'claro');
    }
  }, [temaOscuro]);

  // --- ESTADOS DE LA BASE DE DATOS ---
  const [simuladores, setSimuladores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);

  // --- CARGAR DATOS DESDE SUPABASE ---
  useEffect(() => {
    cargarSimuladores();
  }, []);

  const cargarSimuladores = async () => {
    setCargando(true);
    // Cambia 'simulaciones' si tu tabla en la migración M4 se llama diferente
    const { data, error } = await supabase
      .from('simulaciones')
      .select('*')
      .order('id', { ascending: false });

    if (error) console.error("Error al cargar BD:", error);
    else setSimuladores(data || []);
    
    setCargando(false);
  };

  const [modalFormulario, setModalFormulario] = useState(false);
  const [simSeleccionado, setSimSeleccionado] = useState(null);
  const [seccionActiva, setSeccionActiva] = useState('catalogo');
  
  const [form, setForm] = useState({ id: null, nombre: '', descripcion: '', creadores: '', url: '', imagen: '' });

  const abrirCrear = () => {
    setForm({ id: null, nombre: '', descripcion: '', creadores: '', url: '', imagen: '' });
    setModalFormulario(true);
  };

  const abrirEditar = (sim, e) => {
    e.stopPropagation(); 
    setForm(sim);
    setModalFormulario(true);
  };

  // --- SUBIR IMAGEN A STORAGE ---
  const manejarSubidaImagen = async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    
    setSubiendoArchivo(true);
    try {
      // El nombre del bucket debe ser 'portadas' (créalo en Supabase y hazlo público)
      const ruta = `portadas_${Date.now()}_${archivo.name.replace(/\s+/g, '_')}`;
      const { error } = await supabase.storage.from('portadas').upload(ruta, archivo);

      if (error) throw error;

      // Obtener link público del Storage
      const { data } = supabase.storage.from('portadas').getPublicUrl(ruta);
      setForm({ ...form, imagen: data.publicUrl });
    } catch (error) {
      alert("Error subiendo archivo: " + error.message);
    } finally {
      setSubiendoArchivo(false);
    }
  };

  // --- GUARDAR O ACTUALIZAR EN BASE DE DATOS ---
  const manejarEnvio = async (e) => {
    e.preventDefault();
    const { id, ...datosGuardar } = form;

    if (id) {
      // Editar
      const { error } = await supabase.from('simulaciones').update(datosGuardar).eq('id', id);
      if (error) return alert("Error al actualizar: " + error.message);
    } else {
      // Crear
      const { error } = await supabase.from('simulaciones').insert([datosGuardar]);
      if (error) return alert("Error al crear: " + error.message);
    }
    
    setModalFormulario(false);
    cargarSimuladores(); // Refrescar catálogo
  };

  // --- ELIMINAR DE BASE DE DATOS ---
  const manejarEliminar = async (id, e) => {
    e.stopPropagation();
    if (window.confirm("¿Estás seguro de que deseas eliminar este simulador permanentemente?")) {
      const { error } = await supabase.from('simulaciones').delete().eq('id', id);
      if (error) alert("Error eliminando: " + error.message);
      else cargarSimuladores();
    }
  };

  const abrirSimulador = (url) => {
    if (url.startsWith('#') || url.startsWith('/')) window.location.href = url; 
    else window.open(url, '_blank'); 
  };

  // Filtrado de vistas
  let simuladoresMostrar = simuladores;
  let tituloSeccion = "Explorar Simulaciones";

  if (seccionActiva === 'mis-sims') {
    // Filtro temporal: Muestra los creados por ti o los agregados recientemente
    simuladoresMostrar = simuladores.filter(sim => sim.creadores?.includes('Luis Felipe Cotes') || sim.id > 2);
    tituloSeccion = "Mis Simulaciones (Gestión)";
  } else if (seccionActiva === 'favoritos') {
    simuladoresMostrar = []; 
    tituloSeccion = "Simulaciones Favoritas";
  }

  return (
    <div className="layout-principal">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
          <span>Uniguajira Sim</span>
        </div>

        <nav className="sidebar-menu">
          <button className={`sidebar-item ${seccionActiva === 'catalogo' ? 'activo' : ''}`} onClick={() => setSeccionActiva('catalogo')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
            <span className="sidebar-texto">Catálogo General</span>
          </button>
          <button className="sidebar-item" onClick={abrirCrear}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span className="sidebar-texto">Subir Simulador</span>
          </button>
          <button className={`sidebar-item ${seccionActiva === 'mis-sims' ? 'activo' : ''}`} onClick={() => setSeccionActiva('mis-sims')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            <span className="sidebar-texto">Mis Simulaciones</span>
          </button>
          <button className={`sidebar-item ${seccionActiva === 'favoritos' ? 'activo' : ''}`} onClick={() => setSeccionActiva('favoritos')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            <span className="sidebar-texto">Favoritos</span>
          </button>
        </nav>

        <div className="sidebar-menu" style={{ marginTop: 'auto', marginBottom: '1rem' }}>
          <button className="sidebar-item" onClick={() => setTemaOscuro(!temaOscuro)}>
            {temaOscuro ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            )}
            <span className="sidebar-texto">{temaOscuro ? 'Modo Claro' : 'Modo Oscuro'}</span>
          </button>
          
          <button className="sidebar-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            <span className="sidebar-texto">Ajustes</span>
          </button>
        </div>
      </aside>

      <main className="contenido-principal">
        <h1>{tituloSeccion}</h1>
        
        {cargando ? (
          <p style={{ color: 'var(--texto-secundario)' }}>Cargando catálogo desde la base de datos...</p>
        ) : simuladoresMostrar.length === 0 ? (
          <p style={{ color: 'var(--texto-secundario)' }}>No hay simuladores en esta sección aún.</p>
        ) : (
          <div className="grilla-catalogo">
            {simuladoresMostrar.map((sim) => (
              <div key={sim.id} className="tarjeta" onClick={() => setSimSeleccionado(sim)}>
                <img src={sim.imagen} alt={sim.nombre} className="tarjeta-imagen" />
                <div className="tarjeta-contenido">
                  <h3>{sim.nombre}</h3>
                  <p>{sim.descripcion?.length > 90 ? sim.descripcion.slice(0, 90) + '...' : sim.descripcion}</p>
                  <span className="creadores-tag">{sim.creadores}</span>
                  
                  {seccionActiva === 'mis-sims' && (
                    <div className="acciones-tarjeta">
                      <button className="btn-icono" onClick={(e) => abrirEditar(sim, e)}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        Editar
                      </button>
                      <button className="btn-icono peligro" onClick={(e) => manejarEliminar(sim.id, e)}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* MODAL: DETALLES DEL SIMULADOR */}
      {simSeleccionado && (
        <div className="modal-overlay" onClick={() => setSimSeleccionado(null)}>
          <div className="modal-caja" onClick={(e) => e.stopPropagation()}>
            <img src={simSeleccionado.imagen} alt="Portada" className="modal-portada" />
            <div className="modal-cuerpo">
              <h2>{simSeleccionado.nombre}</h2>
              <p><strong>Descripción:</strong><br/>{simSeleccionado.descripcion}</p>
              <p><strong>Desarrollado por:</strong> {simSeleccionado.creadores}</p>
              
              <button className="btn btn-primario btn-iniciar" onClick={() => abrirSimulador(simSeleccionado.url)}>
                Iniciar Simulación
              </button>
              <div className="botones-modal">
                <button className="btn btn-secundario" onClick={() => setSimSeleccionado(null)}>Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MULTIUSO: CREAR Y EDITAR CON ARCHIVOS */}
      {modalFormulario && (
        <div className="modal-overlay" onClick={() => setModalFormulario(false)}>
          <div className="modal-caja" onClick={(e) => e.stopPropagation()}>
            <div className="modal-cuerpo">
              <h2>{form.id ? 'Editar Simulador' : 'Subir Nuevo Simulador'}</h2>
              <form onSubmit={manejarEnvio}>
                <div className="formulario-grupo">
                  <label>Nombre del simulador</label>
                  <input required type="text" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} placeholder="Ej. Redes Computacionales" />
                </div>
                
                {/* AHORA ES UN INPUT DE TIPO FILE */}
                <div className="formulario-grupo">
                  <label>Imagen de portada (Subir archivo)</label>
                  <input type="file" accept="image/*" onChange={manejarSubidaImagen} required={!form.imagen} />
                  {subiendoArchivo && <span style={{fontSize: '0.85rem', color: 'var(--primario)'}}>Subiendo imagen al servidor...</span>}
                  {form.imagen && !subiendoArchivo && (
                    <img src={form.imagen} alt="Vista previa" style={{ width: '100px', height: '60px', objectFit: 'cover', borderRadius: '4px', marginTop: '0.5rem', border: '1px solid var(--borde)' }} />
                  )}
                </div>

                <div className="formulario-grupo">
                  <label>Descripción detallada</label>
                  <textarea required rows="3" value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} placeholder="¿Qué conceptos enseña este simulador?" />
                </div>
                <div className="formulario-grupo">
                  <label>Estudiantes Creadores</label>
                  <input required type="text" value={form.creadores} onChange={e => setForm({...form, creadores: e.target.value})} placeholder="Ej. Luis Felipe Cotes, Alana Lemus" />
                </div>
                <div className="formulario-grupo">
                  <label>Link de redirección (URL interna o externa)</label>
                  <input required type="text" value={form.url} onChange={e => setForm({...form, url: e.target.value})} placeholder="https://... o #/simulacion/ruta" />
                </div>
                
                <div className="botones-modal">
                  <button type="button" className="btn btn-secundario" disabled={subiendoArchivo} onClick={() => setModalFormulario(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primario" disabled={subiendoArchivo}>
                    {subiendoArchivo ? 'Subiendo...' : (form.id ? 'Guardar Cambios' : 'Subir Simulador')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}