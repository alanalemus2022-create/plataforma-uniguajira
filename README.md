# Plataforma de Simulaciones Académicas · Uniguajira — versión integrada

Une los módulos entregados (M1 cuentas/roles, M4 marco y visor, M6 base de datos y comunidad) en una
plataforma que **se ejecuta con un solo comando**, sin cuenta de Supabase ni PostgreSQL instalado.

## Requisitos
Node.js 20 o superior. Nada más.

## Ejecutar
```
Windows:        doble clic en iniciar.bat
Linux / macOS:  ./iniciar.sh
Manual:         npm install && npm start
```
Abrir **http://localhost:3000**. La primera ejecución aplica las migraciones y crea los datos iniciales.

| Cuenta de demostración | Correo | Contraseña | Rol |
|---|---|---|---|
| Administrador | admin@uniguajira.edu.co | Admin12345 | administrador |
| Estudiante | estudiante@uniguajira.edu.co | Estudiante12345 | estudiante |

**Cambia la contraseña del administrador antes de exponerla a otros** (variable `ADMIN_CLAVE` antes del primer arranque).
Variables: `PORT` (3000), `DATA_DIR` (`./datos`). Para reiniciar de cero, borrar la carpeta `datos/`.

## Qué hace hoy
- Registro e ingreso; el rol nace siempre como estudiante (M1).
- Catálogo con búsqueda por nombre y tipo (**sustituto provisional** de M2/M3).
- Página de simulación con AVL: insertar, eliminar, rotaciones paso a paso, pausa, paso atrás, velocidad, guardar configuración (M4).
- Favoritos / lista de estudio, valoración 1–5, comentarios, conteo de vistas y panel del autor (M6).

## Cómo está armado
- `supabase/migrations/` — SQL de M1, M4 y M6 **sin modificar**, con numeración única (ver informe §5). `migrations_down/` las reversas.
- `server/` — base PostgreSQL embebida (PGlite) que aplica esas migraciones, autenticación y una API que ejecuta cada consulta
  con el rol de BD (`anon`/`authenticated`) y `auth.uid()` del usuario, de modo que **la seguridad por filas (RLS) es la real**.
- `src/m4/` — código de M4 sin modificar. `src/ui/` y `src/cliente.js` — interfaz y cliente nuevos (el cliente imita `supabase-js`,
  por lo que migrar a Supabase real solo exige cambiar `src/cliente.js`).
- `dist/` — frontend ya compilado. Tras editar `src/`: `npm run build`.

## Pruebas
```
npm test                                  # M4: 35 pruebas de lógica (Node)
npm start   (en otra terminal) y luego
PORT=3000 npm run test:e2e                # integración M1+M4+M6: 8 pruebas contra el servidor
```
Documentación de cada módulo y el informe de integración: carpeta `docs/`.
