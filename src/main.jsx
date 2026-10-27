import { useEffect, useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase } from './cliente.js';
import { crearRegistro } from './m4/nucleo/registro.js';
import { cargadores } from './m4/integradas/index.js';
import PaginaSimulacion from './m4/react/PaginaSimulacion.jsx';
import Acceso from './ui/Acceso.jsx';
import Catalogo from './ui/Catalogo.jsx';
import Comunidad from './ui/Comunidad.jsx';
import PanelAutor from './ui/PanelAutor.jsx';
import './ui/app.css';

const registro = crearRegistro(cargadores); // fuera de los componentes (indicación de M4)
const ORIGENES = [];                        // sin Storage todavía (M5 pendiente): solo simulaciones integradas
const ruta = () => (location.hash.replace(/^#\/?/, '') || 'catalogo').split('/');

function App() {
  const [r, setR] = useState(ruta());
  // 1. CORRECCIÓN: Inicializamos en null, ya que el SDK no tiene .usuarioId() síncrono
  const [uid, setUid] = useState(null); 
  const [perfil, setPerfil] = useState(null);

  useEffect(() => { 
    const f = () => setR(ruta()); 
    addEventListener('hashchange', f); 
    return () => removeEventListener('hashchange', f); 
  }, []);
  
  // 2. CORRECCIÓN: Uso de getSession y onAuthStateChange del SDK oficial
  useEffect(() => {
    // Obtenemos la sesión actual nada más cargar la página
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUid(session?.user?.id || null);
    });

    // Escuchamos activamente cuando el usuario inicia sesión o se sale
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUid(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);
  
  useEffect(() => { // el perfil propio lo permite leer la RLS de M1
    if (!uid) return setPerfil(null);
    supabase.from('perfiles').select('nombre_completo, correo, rol').eq('id', uid).maybeSingle().then(({ data }) => setPerfil(data));
  }, [uid]);

  let vista;
  if (r[0] === 'acceso') vista = <Acceso alEntrar={() => { location.hash = '#/catalogo'; }} />;
  else if (r[0] === 'simulacion' && r[1]) vista = (
    <>
      <PaginaSimulacion supabase={supabase} clave={r[1]} registro={registro} origenesPermitidos={ORIGENES} usuarioId={uid} configId={r[2]} />
      <Comunidad clave={r[1]} uid={uid} perfil={perfil} />
    </>
  );
  else if (r[0] === 'panel') vista = uid ? <PanelAutor /> : <Acceso alEntrar={() => { location.hash = '#/panel'; }} />;
  else vista = <Catalogo />;

  // Se eliminó el <header className="barra"> porque ahora Catalogo.jsx maneja el sidebar lateral
  return (
    <main style={{ minHeight: '100vh', width: '100vw' }}>
      {vista}
    </main>
  );
}

createRoot(document.getElementById('raiz')).render(<App />);