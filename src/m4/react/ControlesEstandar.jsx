import { useState } from 'react';
import { useControlador } from './useControlador.js';

function Campo({ def, valor, onChange }) {
  const id = `c-${def.clave}`;
  if (def.tipo === 'booleano') return <label className="campo"><input type="checkbox" checked={!!valor} onChange={(e) => onChange(e.target.checked)} /> {def.etiqueta}</label>;
  if (def.tipo === 'opcion') return <label className="campo" htmlFor={id}>{def.etiqueta}<select id={id} value={valor} onChange={(e) => onChange(e.target.value)}>{def.opciones.map((o) => <option key={o}>{o}</option>)}</select></label>;
  return <label className="campo" htmlFor={id}>{def.etiqueta}<input id={id} type="number" inputMode={def.tipo === 'entero' ? 'numeric' : 'decimal'} min={def.min} max={def.max} step={def.tipo === 'entero' ? 1 : 'any'} value={valor ?? ''} onChange={(e) => onChange(e.target.value)} /></label>;
}

function FormAccion({ accion, onEjecutar }) {
  const [vals, setVals] = useState({});
  return (
    <form className="accion" onSubmit={(e) => { e.preventDefault(); onEjecutar(accion.clave, vals); }}>
      {accion.campos.map((c) => <Campo key={c.clave} def={c} valor={vals[c.clave]} onChange={(v) => setVals({ ...vals, [c.clave]: v })} />)}
      <button type="submit">{accion.etiqueta}</button>
    </form>
  );
}

/** Controles estándar (RF-13) generados a partir del manifiesto: iniciar, pausar, reiniciar, paso, parámetros y acciones. */
export default function ControlesEstandar({ controlador, manifiesto }) {
  const s = useControlador(controlador);
  const tiene = (c) => s.controles.includes(c);
  const enMarcha = s.estado === 'reproduciendo';
  const sinListo = s.estado === 'cargando' || s.estado === 'error';
  return (
    <div className="controles">
      <div className="botones" role="group" aria-label="Controles de la simulación">
        {tiene('iniciar') && <button onClick={enMarcha ? controlador.pausar : controlador.iniciar} disabled={sinListo || (!enMarcha && !s.pendiente)}>{enMarcha ? 'Pausar' : 'Iniciar'}</button>}
        {tiene('paso_atras') && <button onClick={controlador.pasoAtras} disabled={sinListo || !s.puedeRetroceder}>◀ Paso atrás</button>}
        {tiene('paso') && <button onClick={controlador.paso} disabled={sinListo || !s.pendiente}>Paso ▶</button>}
        <button onClick={controlador.reiniciar} disabled={s.estado === 'cargando'}>Reiniciar</button>
      </div>
      {tiene('velocidad') && <label className="campo">Velocidad<input type="range" min="100" max="3000" step="100" value={3100 - s.velocidadMs} onChange={(e) => controlador.setVelocidad(3100 - Number(e.target.value))} aria-label="Velocidad de la animación" /></label>}
      {manifiesto.acciones.map((a) => <FormAccion key={a.clave} accion={a} onEjecutar={(k, v) => controlador.ejecutar(k, v)} />)}
      {manifiesto.parametros.length > 0 && (
        <fieldset className="parametros"><legend>Parámetros</legend>
          {manifiesto.parametros.map((p) => <Campo key={p.clave} def={p} valor={s.parametros[p.clave]} onChange={(v) => controlador.setParametro(p.clave, v)} />)}
        </fieldset>
      )}
      <div aria-live="polite" className="estado">
        {s.total > 0 && <span>Paso {s.indice + 1} de {s.total}</span>}
        {s.aviso && <p className="aviso" role="alert">{s.aviso}</p>}
        {s.error && <p className="error" role="alert">{s.error}</p>}
      </div>
    </div>
  );
}
