import { calcularLayout } from '../nucleo/layoutArbol.js';

// Dibuja un frame de vista "arbol" en SVG responsivo (RNF-04). Los colores combinan color + forma/borde (no solo color).
export default function VistaArbol({ frame }) {
  const { nodos, aristas, ancho, alto, radio } = calcularLayout(frame.arbol);
  const r = frame.resaltados ?? {};
  const o = frame.opciones ?? {};
  const clase = (v) => ['nodo', r.comparando?.includes(v) && 'comparando', r.nuevo?.includes(v) && 'nuevo',
    r.desbalanceado?.includes(v) && 'desbalanceado', r.rotado?.includes(v) && 'rotado'].filter(Boolean).join(' ');
  if (nodos.length === 0) return <p className="visor-vacio">El árbol está vacío. Inserta un valor para empezar.</p>;
  return (
    <svg className="visor-arbol" viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label={`Árbol AVL con ${nodos.length} nodos`}>
      {aristas.map((a) => <line key={`${a.de.v}-${a.a.v}`} x1={a.de.x} y1={a.de.y} x2={a.a.x} y2={a.a.y} className="arista" />)}
      {nodos.map((n) => (
        <g key={n.v} className={clase(n.v)} transform={`translate(${n.x},${n.y})`}>
          <circle r={radio} />
          <text textAnchor="middle" dy="0.35em">{n.v}</text>
          {o.mostrarFb && <text className="fb" textAnchor="middle" y={-radio - 6}>FB {n.fb}</text>}
          {o.mostrarAltura && <text className="alt" textAnchor="middle" y={radio + 14}>h {n.h}</text>}
        </g>
      ))}
    </svg>
  );
}
