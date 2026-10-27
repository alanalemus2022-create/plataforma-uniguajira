// Datos iniciales: administrador, estudiante de demostración y la simulación AVL de M4 (RF-14).
import { manifiesto as manifiestoAVL } from '../src/m4/integradas/avl/index.js';
import { aFilaSimulacion } from '../src/m4/contrato/manifiesto.js';

export async function sembrar(db, hashClave) {
  if ((await db.query('select 1 from public.simulaciones limit 1')).rows.length) return;
  
  const mk = async (correo, nombre, clave) => {
    // 1. Verificamos si el usuario ya existe para evitar errores de duplicados
    const existe = await db.query('select id from auth.users where email=$1', [correo]);
    if (existe.rows.length > 0) return existe.rows[0].id;
    
    // 2. Si no existe, lo creamos
    const u = (await db.query(`insert into auth.users(email, raw_user_meta_data) values ($1,$2) returning id`, [correo, JSON.stringify({ nombre_completo: nombre })])).rows[0];
    await db.query('insert into auth.credenciales values ($1,$2)', [u.id, hashClave(clave)]);
    return u.id;
  };
  
  const adm = await mk('admin@uniguajira.edu.co', 'Administrador', process.env.ADMIN_CLAVE || 'Admin12345');
  await mk('estudiante@uniguajira.edu.co', 'Estudiante Demo', 'Estudiante12345');
  
  // Primer administrador: instrucción manual prevista por M1 (sección 8 del SQL), hecha aquí una sola vez.
  await db.query(`update public.perfiles set rol='administrador' where id=$1`, [adm]);
  
  const f = aFilaSimulacion(manifiestoAVL, adm);
  
  // --- ADAPTACIÓN AL NUEVO ESQUEMA DE BASE DE DATOS ---
  f.url = f.punto_entrada; 
  delete f.punto_entrada;  
  f.imagen = 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?auto=format&fit=crop&q=80&w=800';
  f.creadores = 'Luis Felipe Cotes';
  // ----------------------------------------------------

  const ks = Object.keys(f);
  await db.query(`insert into public.simulaciones (${ks.join(',')}, estado) values (${ks.map((_, i) => `$${i + 1}`).join(',')}, 'publicada')`,
    ks.map(k => (k === 'manifiesto' ? JSON.stringify(f[k]) : f[k])));
    
  console.log('  datos iniciales creados (admin, estudiante demo, simulación AVL)');
}