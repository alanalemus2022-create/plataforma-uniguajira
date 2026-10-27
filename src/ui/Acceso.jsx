import { useState } from 'react';
import { supabase } from '../cliente.js';

export default function Acceso({ alEntrar }) {
  const [modo, setModo] = useState('ingreso');
  const [f, setF] = useState({ nombre: '', correo: '', clave: '' });
  const [verClave, setVerClave] = useState(false);
  const [err, setErr] = useState('');
  const [exito, setExito] = useState('');
  const [cargando, setCargando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setErr('');
    setExito('');
    setCargando(true);

    try {
      let r;
      if (modo === 'recuperar') {
        r = await supabase.auth.resetPasswordForEmail(f.correo);
        if (r.error) throw r.error;
        setExito('Se ha enviado un enlace de recuperación a tu correo.');
      } else if (modo === 'ingreso') {
        r = await supabase.auth.signInWithPassword({
          email: f.correo,
          password: f.clave,
        });
        if (r.error) throw r.error;
        alEntrar();
      } else {
        r = await supabase.auth.signUp({
          email: f.correo,
          password: f.clave,
          options: { data: { nombre_completo: f.nombre } },
        });
        if (r.error) throw r.error;
        alEntrar();
      }
    } catch (e) {
      setErr(e.message || 'Error de conexión con el servidor.');
    } finally {
      setCargando(false);
    }
  };

  const c = (k) => ({
    value: f[k],
    onChange: (e) => setF({ ...f, [k]: e.target.value }),
  });

  const usarCredencialesDemo = () => {
    setModo('ingreso');
    setF({ nombre: '', correo: 'estudiante@uniguajira.edu.co', clave: 'Estudiante12345' });
    setErr('');
    setExito('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0f1c] relative overflow-hidden !p-4">
      {/* Luces de fondo (Efecto moderno) */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-600/15 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Tarjeta Principal Glassmorphism */}
      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden !p-8 relative z-10">
        
        {/* Cabecera Premium */}
        <div className="flex flex-col items-center !mb-8">
          <div className="flex items-center justify-center !w-16 !h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 !mb-4 border border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.15)]">
            <svg className="!w-8 !h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="!text-2xl font-black bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent tracking-tight">
            Simulador Académico
          </h1>
          <p className="!text-sm text-slate-400 !mt-2 font-medium">Plataforma de entrenamiento</p>
        </div>

        {/* Pestañas estilo iOS */}
        {modo !== 'recuperar' && (
          <div className="flex bg-slate-950/50 !p-1.5 rounded-xl !mb-8 border border-slate-800/80 shadow-inner">
            <button
              type="button"
              onClick={() => { setModo('ingreso'); setErr(''); setExito(''); }}
              className={`flex-1 flex items-center justify-center !h-10 !text-sm font-bold rounded-lg transition-all duration-300 ${
                modo === 'ingreso' ? 'bg-indigo-600/90 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-400 hover:text-white'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => { setModo('registro'); setErr(''); setExito(''); }}
              className={`flex-1 flex items-center justify-center !h-10 !text-sm font-bold rounded-lg transition-all duration-300 ${
                modo === 'registro' ? 'bg-indigo-600/90 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-400 hover:text-white'
              }`}
            >
              Crear Cuenta
            </button>
          </div>
        )}

        {/* Alertas */}
        {err && (
          <div className="!mb-6 !p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 !text-sm flex items-center !gap-3 font-medium">
            <svg className="!w-5 !h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>{err}</span>
          </div>
        )}
        {exito && (
          <div className="!mb-6 !p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 !text-sm flex items-center !gap-3 font-medium">
            <svg className="!w-5 !h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
            <span>{exito}</span>
          </div>
        )}

        {/* Formulario a prueba de fallos (Flex column + gap en vez de margin) */}
        <form onSubmit={enviar} className="flex flex-col !gap-5">
          {modo === 'registro' && (
            <div className="flex flex-col !gap-2">
              <label className="!text-sm font-semibold text-slate-300">Nombre completo</label>
              <div className="flex items-center !h-12 !px-4 bg-slate-950/50 border border-slate-700/80 rounded-xl focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all overflow-hidden group">
                <svg className="!w-5 !h-5 shrink-0 text-slate-500 group-focus-within:text-indigo-400 transition-colors !mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                <input type="text" required maxLength={120} placeholder="ej. Alana Lemus Mendoza" className="flex-1 !h-full w-full bg-transparent !text-sm text-white placeholder-slate-600 outline-none border-none !p-0 !m-0 font-medium" {...c('nombre')} />
              </div>
            </div>
          )}

          <div className="flex flex-col !gap-2">
            <label className="!text-sm font-semibold text-slate-300">Correo institucional</label>
            <div className="flex items-center !h-12 !px-4 bg-slate-950/50 border border-slate-700/80 rounded-xl focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all overflow-hidden group">
              <svg className="!w-5 !h-5 shrink-0 text-slate-500 group-focus-within:text-indigo-400 transition-colors !mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" /></svg>
              <input type="email" required autoComplete="email" placeholder="usuario@uniguajira.edu.co" className="flex-1 !h-full w-full bg-transparent !text-sm text-white placeholder-slate-600 outline-none border-none !p-0 !m-0 font-medium" {...c('correo')} />
            </div>
          </div>

          {modo !== 'recuperar' && (
            <div className="flex flex-col !gap-2">
              <label className="!text-sm font-semibold text-slate-300">Contraseña</label>
              <div className="flex items-center !h-12 !px-4 bg-slate-950/50 border border-slate-700/80 rounded-xl focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all overflow-hidden group">
                <svg className="!w-5 !h-5 shrink-0 text-slate-500 group-focus-within:text-indigo-400 transition-colors !mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                <input type={verClave ? "text" : "password"} required minLength={8} autoComplete={modo === 'ingreso' ? 'current-password' : 'new-password'} placeholder="••••••••" className="flex-1 !h-full w-full bg-transparent !text-sm tracking-widest text-white placeholder-slate-600 outline-none border-none !p-0 !m-0 font-medium" {...c('clave')} />
                <button type="button" onClick={() => setVerClave(!verClave)} className="shrink-0 !ml-3 text-slate-500 hover:text-indigo-400 transition-colors flex items-center justify-center !h-full">
                  <svg className="!w-5 !h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {verClave ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a9.04 9.04 0 012.122-.363c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m-1.742 1.742L3 3l18 18" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />}
                  </svg>
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="w-full !h-13 !mt-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold !text-[15px] rounded-xl shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center !gap-2 !py-3"
          >
            {cargando ? (
              <>
                <svg className="animate-spin !w-5 !h-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <span>Autenticando...</span>
              </>
            ) : (
              <span>{modo === 'ingreso' ? 'Ingresar a la Plataforma' : modo === 'registro' ? 'Completar Registro' : 'Enviar Enlace'}</span>
            )}
          </button>
        </form>

        {/* Acciones Secundarias */}
        <div className="flex flex-col items-center !mt-6 !gap-4">
          {modo === 'ingreso' ? (
            <button type="button" onClick={() => { setModo('recuperar'); setErr(''); setExito(''); }} className="!text-sm font-medium text-slate-400 hover:text-indigo-400 transition-colors">¿Olvidaste tu contraseña?</button>
          ) : modo === 'recuperar' ? (
            <button type="button" onClick={() => { setModo('ingreso'); setErr(''); setExito(''); }} className="!text-sm font-medium text-slate-400 hover:text-indigo-400 transition-colors">Volver al inicio de sesión</button>
          ) : null}

          <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent !my-2"></div>
          
          <button type="button" onClick={usarCredencialesDemo} className="group inline-flex items-center justify-center !h-10 !px-5 rounded-full bg-slate-900/80 border border-slate-700/80 !text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:border-indigo-500/50 hover:bg-slate-800 transition-all duration-300 !gap-2 shadow-sm">
            <svg className="!w-4 !h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            Auto-completar cuenta demo
          </button>
        </div>

      </div>
    </div>
  );
}