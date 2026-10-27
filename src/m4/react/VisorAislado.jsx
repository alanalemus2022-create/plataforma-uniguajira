import { useEffect, useMemo, useRef } from 'react';
import { ATRIBUTOS_SANDBOX, prepararDocumentoAislado } from '../aislado/documento.js';
import { crearPuente } from '../aislado/puente.js';

/** Ejecuta una simulación de usuario dentro de un iframe aislado (RF-19). `onPuente` entrega el controlador-like. */
export default function VisorAislado({ html, manifiesto, onPuente }) {
  const ref = useRef(null);
  const puenteRef = useRef(null);
  const doc = useMemo(() => prepararDocumentoAislado(html), [html]);
  useEffect(() => {
    const p = crearPuente({ ventana: window, destino: ref.current.contentWindow, manifiesto });
    puenteRef.current = p; onPuente(p);
    return () => p.dispose();
  }, [manifiesto, doc]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <iframe ref={ref} className="visor-aislado" title={`Simulación: ${manifiesto.nombre}`}
      sandbox={ATRIBUTOS_SANDBOX} srcDoc={doc} referrerPolicy="no-referrer" allow=""
      onLoad={() => puenteRef.current?.alCargar()} />
  );
}
