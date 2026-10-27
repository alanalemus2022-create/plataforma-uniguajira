import VistaArbol from './VistaArbol.jsx';
import ControlesEstandar from './ControlesEstandar.jsx';
import { useControlador } from './useControlador.js';

const VISTAS = { arbol: VistaArbol };

/** Visor de simulaciones integradas: dibuja el frame actual según manifiesto.vista y muestra los controles. */
export default function VisorSimulacion({ controlador, manifiesto }) {
  const s = useControlador(controlador);
  const Vista = VISTAS[manifiesto.vista];
  return (
    <section className="visor">
      <div className="visor-lienzo">{Vista && s.frame ? <Vista frame={s.frame} /> : <p className="visor-vacio">Vista no disponible.</p>}</div>
      <p className="visor-mensaje" aria-live="polite">{s.frame?.mensaje}</p>
      {s.frame?.regla && <p className="visor-regla">{s.frame.regla}</p>}
      <ControlesEstandar controlador={controlador} manifiesto={manifiesto} />
    </section>
  );
}
