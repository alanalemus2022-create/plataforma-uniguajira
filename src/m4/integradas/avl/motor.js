// M4 · Motor AVL puro (sin DOM). Cada operación genera una lista de "frames" (pasos) que el visor reproduce.
// Factor de balance FB = altura(izq) − altura(der). Altura de un nodo hoja = 1.
const alt = (n) => (n ? n.h : 0);
const fb = (n) => (n ? alt(n.i) - alt(n.d) : 0);
const actualizar = (n) => { n.h = 1 + Math.max(alt(n.i), alt(n.d)); };
const serializar = (n) => (n ? { v: n.v, h: n.h, fb: fb(n), i: serializar(n.i), d: serializar(n.d) } : null);

export const REGLAS = {
  LL: 'Caso izquierda-izquierda: el hijo izquierdo está cargado a la izquierda → una rotación simple a la derecha.',
  LR: 'Caso izquierda-derecha: el hijo izquierdo está cargado a la derecha → rotación a la izquierda sobre el hijo y luego a la derecha sobre el nodo.',
  RR: 'Caso derecha-derecha: el hijo derecho está cargado a la derecha → una rotación simple a la izquierda.',
  RL: 'Caso derecha-izquierda: el hijo derecho está cargado a la izquierda → rotación a la derecha sobre el hijo y luego a la izquierda sobre el nodo.',
};

export function crearMotorAvl() {
  let raiz = null;
  let frames = [];
  let idx = 0;

  const frame = (mensaje, resaltados = {}, regla = null) => ({
    vista: 'arbol', arbol: serializar(raiz), mensaje, regla,
    resaltados: { comparando: [], nuevo: [], desbalanceado: [], rotado: [], ...resaltados },
  });
  const reemplazar = (padre, viejo, nuevo) => {
    if (!padre) raiz = nuevo; else if (padre.i === viejo) padre.i = nuevo; else padre.d = nuevo;
  };
  const rotarDerecha = (n, padre) => { const x = n.i; n.i = x.d; x.d = n; actualizar(n); actualizar(x); reemplazar(padre, n, x); return x; };
  const rotarIzquierda = (n, padre) => { const x = n.d; n.d = x.i; x.i = n; actualizar(n); actualizar(x); reemplazar(padre, n, x); return x; };
  const recalcular = (ruta, hasta = ruta.length) => { for (let k = hasta - 1; k >= 0; k--) actualizar(ruta[k]); };

  function reequilibrar(ruta, out) {
    recalcular(ruta);
    let huboRotacion = false;
    for (let k = ruta.length - 1; k >= 0; k--) {
      const n = ruta[k];
      actualizar(n);
      const b = fb(n);
      if (Math.abs(b) <= 1) continue;
      huboRotacion = true;
      const padre = k > 0 ? ruta[k - 1] : null;
      let caso;
      if (b > 1) caso = fb(n.i) >= 0 ? 'LL' : 'LR'; else caso = fb(n.d) <= 0 ? 'RR' : 'RL';
      out.push(frame(`Desbalance en ${n.v}: FB = ${b}`, { desbalanceado: [n.v] }, REGLAS[caso]));
      if (caso === 'LL') { const x = rotarDerecha(n, padre); recalcular(ruta, k); out.push(frame(`Rotación a la derecha sobre ${n.v}`, { rotado: [x.v, n.v] }, REGLAS.LL)); }
      else if (caso === 'RR') { const x = rotarIzquierda(n, padre); recalcular(ruta, k); out.push(frame(`Rotación a la izquierda sobre ${n.v}`, { rotado: [x.v, n.v] }, REGLAS.RR)); }
      else if (caso === 'LR') {
        const hijo = n.i; const y = rotarIzquierda(hijo, n); actualizar(n);
        out.push(frame(`Rotación a la izquierda sobre ${hijo.v}`, { rotado: [y.v, hijo.v] }, REGLAS.LR));
        const x = rotarDerecha(n, padre); recalcular(ruta, k);
        out.push(frame(`Rotación a la derecha sobre ${n.v}`, { rotado: [x.v, n.v] }, REGLAS.LR));
      } else {
        const hijo = n.d; const y = rotarDerecha(hijo, n); actualizar(n);
        out.push(frame(`Rotación a la derecha sobre ${hijo.v}`, { rotado: [y.v, hijo.v] }, REGLAS.RL));
        const x = rotarIzquierda(n, padre); recalcular(ruta, k);
        out.push(frame(`Rotación a la izquierda sobre ${n.v}`, { rotado: [x.v, n.v] }, REGLAS.RL));
      }
    }
    out.push(frame(huboRotacion ? 'Árbol equilibrado de nuevo: todos los FB están entre −1 y 1.' : 'Todos los FB están entre −1 y 1: no hace falta rotar.'));
  }

  const inicio = () => [frame('Estado actual del árbol')];
  const publicar = (out) => { frames = out; idx = 0; };

  function insertar(v) {
    const out = inicio(); const ruta = [];
    if (!raiz) { raiz = { v, h: 1, i: null, d: null }; out.push(frame(`Árbol vacío: ${v} es la raíz`, { nuevo: [v] })); publicar(out); return { ok: true }; }
    let n = raiz;
    for (;;) {
      if (v === n.v) { publicar([frame(`${v} ya está en el árbol: un AVL no admite duplicados`, { comparando: [v] })]); return { ok: true }; }
      const izq = v < n.v;
      out.push(frame(`Comparar ${v} con ${n.v}: es ${izq ? 'menor → izquierda' : 'mayor → derecha'}`, { comparando: [n.v] }));
      ruta.push(n);
      const sig = izq ? n.i : n.d;
      if (!sig) { const nuevo = { v, h: 1, i: null, d: null }; if (izq) n.i = nuevo; else n.d = nuevo; break; }
      n = sig;
    }
    recalcular(ruta);
    out.push(frame(`Insertar ${v} como hoja; se actualizan alturas y FB hacia la raíz`, { nuevo: [v] }));
    reequilibrar(ruta, out);
    publicar(out); return { ok: true };
  }

  function eliminar(v) {
    const out = inicio(); const ruta = [];
    let n = raiz;
    while (n && n.v !== v) { out.push(frame(`Buscar ${v}: comparar con ${n.v}`, { comparando: [n.v] })); ruta.push(n); n = v < n.v ? n.i : n.d; }
    if (!n) { publicar([frame(`${v} no está en el árbol`)]); return { ok: true }; }
    out.push(frame(`Nodo ${v} encontrado`, { comparando: [v] }));
    const padre = ruta[ruta.length - 1] ?? null;
    if (!n.i || !n.d) {
      reemplazar(padre, n, n.i ?? n.d);
      recalcular(ruta);
      out.push(frame(`${v} tiene ${n.i || n.d ? 'un hijo: se reemplaza por él' : 'ningún hijo: se elimina'}`));
    } else {
      ruta.push(n);
      let s = n.d;
      while (s.i) { out.push(frame(`Buscar sucesor inorden: bajar a la izquierda desde ${s.v}`, { comparando: [s.v] })); ruta.push(s); s = s.i; }
      const sv = s.v;
      reemplazar(ruta[ruta.length - 1], s, s.d);
      n.v = sv;
      recalcular(ruta);
      out.push(frame(`${v} tiene dos hijos: lo reemplaza su sucesor inorden (${sv})`, { nuevo: [sv] }));
    }
    reequilibrar(ruta, out);
    publicar(out); return { ok: true };
  }

  const motor = {
    insertar, eliminar,
    cargarEjemplo() { raiz = null; for (const v of [50, 30, 70, 20, 40, 60, 80]) insertar(v); publicar([frame('Ejemplo cargado: árbol equilibrado de 7 nodos. Prueba insertar 10 y luego 5.')]); return { ok: true }; },
    reiniciar() { raiz = null; publicar([frame('Árbol vacío')]); },
    frameActual: () => frames[idx],
    posicion: () => ({ indice: idx, total: frames.length }),
    avanzar() { if (idx < frames.length - 1) { idx++; return true; } return false; },
    retroceder() { if (idx > 0) { idx--; return true; } return false; },
    arbol: () => serializar(raiz),
  };
  motor.reiniciar();
  return motor;
}

/** Comprueba invariantes AVL sobre un árbol serializado (para pruebas). */
export function esAvlValido(a, min = -Infinity, max = Infinity) {
  if (!a) return { ok: true, h: 0 };
  if (a.v <= min || a.v >= max) return { ok: false, h: 0 };
  const l = esAvlValido(a.i, min, a.v), r = esAvlValido(a.d, a.v, max);
  const h = 1 + Math.max(l.h, r.h);
  return { ok: l.ok && r.ok && Math.abs(l.h - r.h) <= 1 && a.h === h && a.fb === l.h - r.h, h };
}
