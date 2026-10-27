# Contexto M4 (marco de simulaciones y visor) para asistentes de IA — Plataforma de Simulaciones, Uniguajira

**Estado real (26-oct-2026, v0.1):** JS probado en Node (35/35 pruebas). SQL escrito y revisado, **no ejecutado** (sin PostgreSQL). React escrito, **solo sintaxis verificada**, nunca renderizado. Aislamiento (iframe + CSP) **no probado en navegadores**.

## Qué es
Contrato común v1 de simulación (manifiesto JSON), controlador de controles estándar, registro de simulaciones integradas, visor y página (React), puente para simulaciones de usuario en iframe aislado, simulación AVL de ejemplo y la tabla `simulaciones`.

## Nombres exactos
- Tablas: `simulaciones(id, autor_id, clave, nombre, descripcion, instrucciones, teoria, tipo, runtime, punto_entrada, contrato_version, manifiesto jsonb, estado, creado_en, actualizado_en)` · `simulacion_configuraciones(id, simulacion_id, usuario_id, nombre, estado jsonb, compartida, creado_en)`.
- Función: `obtener_configuracion(p_id uuid)`.
- `tipo`: `visualizador|simulador|ejercicio|otro`. `runtime`: `integrada|aislada`. `estado`: `borrador|en_revision|publicada|rechazada|retirada`.
- JS: `validarManifiesto`, `validarParametros`, `validarArgsAccion`, `aFilaSimulacion`, `desdeFilaSimulacion`, `crearRegistro`, `crearControlador`, `crearPuente`, `prepararDocumentoAislado`, `descargarHtmlAislado`, `obtenerTokenVisitante`; React: `PaginaSimulacion`, `VisorSimulacion`, `ControlesEstandar`, `VisorAislado`, `VistaArbol`. SDK en el iframe: `window.UniSim`.
- Ruta propuesta: `/simulacion/:clave`.

## Contratos (confirmar con sus dueños)
- M1: `perfiles(id)`, `es_moderador()`, `es_administrador()`, `tocar_actualizado_en()`.
- M6: `registrar_vista(uuid, text)` la llama `PaginaSimulacion` al abrir; token de 36 caracteres.
- M5: transiciones de estado, políticas UPDATE/DELETE, versionado, subida del HTML, validación del manifiesto también en servidor.
- M2: tabla puente simulación↔tema. M3: busca sobre `simulaciones` publicadas.

## Reglas que no se deben cambiar sin acordar
- Una simulación `integrada` se resuelve **solo** contra el registro del código; nunca se carga una URL de la BD fuera del iframe aislado.
- El cliente no puede fijar `estado` al crear (nace `borrador`); solo un administrador crea `integrada`.
- Todo `manifiesto` y toda configuración recibida (BD, otro usuario, iframe) se valida antes de usarse.
- El iframe usa `sandbox="allow-scripts"` **sin** `allow-same-origin`. Nunca claves privilegiadas en el navegador.
- Texto de usuario (instrucciones, teoría, mensajes) se muestra como texto, no como HTML.

## Numeración de migraciones (PROPUESTA; M1 y M6 chocan en `0001`)
M1 `20261026000100` → M4 `20261026000200` → M6 `20261026000300…`.

## Pendientes principales
Ejecutar el SQL; renderizar React; probar el aislamiento en navegadores; más vistas (listas, grafos, colas); pantalla de configuraciones (RF-15); autor y distintivo oficial en la página; medir RNF-01. Detalle en el informe §7.

## Cómo continuar
1. `npm test` (JS). 2. `bash tests/sql/run_sql_tests.sh` (SQL). 3. Agregar una simulación integrada: carpeta en `src/integradas/<nombre>/index.js` con `manifiesto` y `crear()` (7 métodos, ver informe §3.2) + una línea en `src/integradas/index.js`. 4. Agregar una simulación aislada: HTML que use `UniSim.registrar(...)` (ver `ejemplos/`), subirlo a Storage y registrar una fila con `aFilaSimulacion` (lo hace M5).
