import { useEffect, useState } from 'react';
import { cargarSimulacionPorClave, registrarVista, guardarConfiguracion, obtenerConfiguracion } from './api.js';
import { desdeFilaSimulacion, validarManifiesto } from '../contrato/manifiesto.js';
import { crearControlador } from '../nucleo/controlador.js';
import { descargarHtmlAislado } from '../aislado/documento.js';
import VisorSimulacion from './VisorSimulacion.jsx';
import VisorAislado from './VisorAislado.jsx';
import ControlesEstandar from './ControlesEstandar.jsx';
import './visor.css';

/**
 * RF-12: descripción, instrucciones, teoría y visor. Props:
 *  supabase · clave (de la URL) · registro (crearRegistro de src/nucleo) · origenesPermitidos (https de Storage)
 *  usuarioId (opcional; habilita guardar configuración, RF-15) · configId (opcional; abre una configuración guardada/compartida).
 */
export default function PaginaSimulacion({ supabase, clave, registro, origenesPermitidos, usuarioId, configId }) {
  const [estado, setEstado] = useState({ fase: 'cargando' });
  const [guardado, setGuardado] = useState(null);

  useEffect(() => {
    let vivo = true, controlador = null;
    (async () => {
      try {
        setEstado({ fase: 'cargando' });
        const fila = await cargarSimulacionPorClave(supabase, clave);
        if (!vivo) return;
        if (!fila) return setEstado({ fase: 'vacio' });
        const manifiesto = desdeFilaSimulacion(fila);
        const v = validarManifiesto(manifiesto);
        if (!v.ok) return setEstado({ fase: 'error', mensaje: 'Esta simulación tiene un formato no válido.' });
        registrarVista(supabase, fila.id); // sin await: no bloquea ni rompe la página
        if (fila.runtime === 'integrada') {
          const sim = await registro.cargar(fila.punto_entrada); // solo claves del registro; nunca URLs de la BD
          controlador = crearControlador(sim.crear(), sim.manifiesto);
          if (configId) { // la configuración no es de confianza: importarConfiguracion la valida entera antes de aplicarla
            const cfg = await obtenerConfiguracion(supabase, configId).catch(() => null);
            const r = cfg && cfg.simulacion_id === fila.id ? controlador.importarConfiguracion(cfg.estado) : { ok: false };
            if (!r.ok) setGuardado('No se pudo abrir la configuración indicada.');
          }
          if (vivo) setEstado({ fase: 'listo', fila, manifiesto: sim.manifiesto, controlador });
        } else {
          const html = await descargarHtmlAislado(fila.punto_entrada, { origenesPermitidos });
          if (vivo) setEstado({ fase: 'listo', fila, manifiesto, html });
        }
      } catch (e) { if (vivo) setEstado({ fase: 'error', mensaje: e.message }); }
    })();
    return () => { vivo = false; controlador?.dispose(); };
  }, [supabase, clave, registro, origenesPermitidos, configId]);

  if (estado.fase === 'cargando') return <p role="status">Cargando simulación…</p>;
  if (estado.fase === 'vacio') return <p>Esta simulación no existe o todavía no está publicada.</p>;
  if (estado.fase === 'error') return <p role="alert">No se pudo abrir la simulación. {estado.mensaje}</p>;

  const { fila, manifiesto, controlador, html } = estado;
  const guardar = async (ctl) => {
    try { await guardarConfiguracion(supabase, { simulacionId: fila.id, usuarioId, nombre: 'Mi configuración', estado: ctl.exportarConfiguracion() }); setGuardado('Configuración guardada'); }
    catch (e) { setGuardado(e.message); }
  };
  return (
    <article className="pagina-simulacion">
      <h1>{fila.nombre}</h1>
      <p>{fila.descripcion}</p>
      {fila.instrucciones && <section><h2>Instrucciones</h2><p className="texto">{fila.instrucciones}</p></section>}
      {fila.runtime === 'integrada'
        ? <VisorSimulacion controlador={controlador} manifiesto={manifiesto} />
        : <AisladoConControles html={html} manifiesto={manifiesto} />}
      {usuarioId && controlador && <button onClick={() => guardar(controlador)}>Guardar configuración</button>}
      {guardado && <p role="status">{guardado}</p>}
      {fila.teoria && <section><h2>Teoría y reglas</h2><p className="texto">{fila.teoria}</p></section>}
    </article>
  );
}

function AisladoConControles({ html, manifiesto }) {
  const [puente, setPuente] = useState(null);
  return (
    <section className="visor">
      <VisorAislado html={html} manifiesto={manifiesto} onPuente={setPuente} />
      {puente && <ControlesEstandar controlador={puente} manifiesto={manifiesto} />}
    </section>
  );
}
