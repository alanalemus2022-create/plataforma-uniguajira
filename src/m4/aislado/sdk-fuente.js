// M4 · SDK que se inyecta DENTRO del iframe aislado. Expone window.UniSim para que una simulación de usuario
// reaccione a los controles estándar y reporte su estado. Se mantiene como texto para inyectarlo en srcdoc.
export const SDK_FUENTE = `(function () {
  var CANAL = 'uniguajira-sim', V = 1, h = {};
  function enviar(m) { m.canal = CANAL; m.version = V; window.parent.postMessage(m, '*'); }
  function llamar(n, a) { try { if (typeof h[n] === 'function') h[n].apply(null, a || []); } catch (e) { enviar({ evento: 'error', mensaje: String(e && e.message || e).slice(0, 300) }); } }
  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (ev.source !== window.parent || !d || d.canal !== CANAL || d.version !== V) return;
    switch (d.cmd) {
      case 'hola': enviar({ evento: 'listo' }); break;
      case 'iniciar': case 'pausar': case 'reiniciar': case 'paso': case 'paso_atras': llamar(d.cmd); break;
      case 'parametro': llamar('parametro', [d.clave, d.valor]); break;
      case 'accion': llamar('accion', [d.accion, d.args]); break;
      case 'velocidad': llamar('velocidad', [d.ms]); break;
    }
  });
  window.UniSim = {
    registrar: function (manejadores) { h = manejadores || {}; enviar({ evento: 'listo' }); },
    estado: function (e) { enviar({ evento: 'estado', estado: e.estado, indice: e.indice | 0, total: e.total | 0, mensaje: String(e.mensaje || '').slice(0, 300) }); },
    error: function (m) { enviar({ evento: 'error', mensaje: String(m).slice(0, 300) }); }
  };
})();`;
