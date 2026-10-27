# Informe de módulo — M4 Marco de simulaciones y visor

**Plataforma de Simulaciones Académicas · Universidad de La Guajira**

## 1. Identificación

- **Módulo:** M4 Marco de simulaciones y visor.
- **Responsable según el documento general:** Jhonner David Bernal Miranda (líder).
- **Fecha:** 26 de octubre de 2026 · **Versión del informe:** 0.1 (diseño + implementación del núcleo, probado en Node; SQL y React sin ejecutar en entorno real).
- **Destinatarios:** todo el equipo y sus asistentes de IA, en especial M1 (Diego Maldonado), M2 (Alana Lemus), M3 (Darilith Ferrer), M5 (Jorge Córdoba) y M6 (Luis Cotes, Samir Iguarán).
- **Paquete:** `m4-visor/` (ver §3 para el árbol de archivos).

**Estado real, sin adornos.**

| Parte | Estado |
|---|---|
| Contrato común (validador, tipos, conversión fila↔manifiesto) | Hecho. **35 de 35 pruebas pasan** en Node 22. |
| Motor AVL (insertar, eliminar, 4 rotaciones, pasos) | Hecho. Incluye prueba aleatoria de 3000 operaciones contra un `Set`. |
| Controlador estándar, registro, puente aislado, SDK, token de vista | Hecho y probado con relojes y ventanas simuladas. |
| Migración SQL (`simulaciones`, configuraciones) y su reversa | Escrita y revisada a mano. **No ejecutada**: el entorno no tenía PostgreSQL. Hay pruebas SQL escritas, también sin ejecutar (§6). |
| Componentes React (página, visor, controles, vista de árbol) | Escritos; solo se comprobó la **sintaxis** con `tsc`. **Nunca se renderizaron** (sin `npm`/React en el entorno). |
| Comportamiento del iframe aislado en navegadores reales | **No probado.** Solo se probó la lógica con simulaciones de `window`. |

## 2. Requerimientos cubiertos

| Código | Estado |
|---|---|
| RF-11 Marco común (nombre, descripción, tema, punto de entrada estándar) | Contrato v1 + tabla `simulaciones` + registro. El **tema** lo vincula M2 (RF-09) con una tabla puente; M4 no la crea. |
| RF-12 Página de simulación (descripción, instrucciones, teoría, visor) | `PaginaSimulacion.jsx`, con estados de carga, vacío y error. Sin estilo definitivo (M6). |
| RF-13 Controles estándar (iniciar, pausar, reiniciar, paso, parámetros) | Controlador + `ControlesEstandar.jsx` generado desde el manifiesto. Se añadieron **paso atrás** y **velocidad**. |
| RF-14 Simulación de ejemplo (AVL con inserción, eliminación y rotaciones) | `src/integradas/avl/`. Reglas y teoría incluidas. |
| RF-15 Guardar/compartir configuración (prioridad B) | Tabla `simulacion_configuraciones`, función `obtener_configuracion(id)`, exportar/importar en el controlador, botón "Guardar" y lectura por `configId`. **Falta** la pantalla para listar/borrar/copiar el enlace. |
| RNF-01 Rendimiento | Parcial. Lógica pura y barata en el hilo principal. Cómputo pesado en simulaciones de usuario: ver §7. |
| RNF-05 Extensibilidad | Cumplido en diseño: una simulación nueva es una carpeta + 1 línea, o una fila en la BD (aislada), sin tocar el núcleo. |
| RF-19 (con M1/M5) | **M4 aporta la parte del visor** (iframe, CSP, protocolo). M1 y M5 deben revisarla y completar su parte (§4, §8). |
| RNF-02 / RNF-04 | RLS en las tablas de M4. SVG responsivo y controles táctiles de 44 px; sin pruebas en móvil reales. |

## 3. Qué se hizo en cada apartado

### 3.1 Árbol de archivos

```
m4-visor/
  supabase/migrations/20261026000200_m4_simulaciones.sql         (+ migrations_down/…down.sql)
  src/contrato/manifiesto.js        contrato v1: validar, normalizar, fila↔manifiesto
  src/nucleo/controlador.js         controles estándar, estados, exportar/importar configuración
  src/nucleo/registro.js            registro de simulaciones integradas
  src/nucleo/layoutArbol.js         posiciones del dibujo del árbol
  src/nucleo/token.js               token aleatorio para registrar_vista (M6)
  src/aislado/{documento,puente,sdk-fuente}.js   aislamiento (RF-19)
  src/integradas/index.js + avl/    catálogo integrado y simulación AVL
  src/react/*                       PaginaSimulacion, VisorSimulacion, ControlesEstandar, VistaArbol, VisorAislado, api, visor.css
  ejemplos/simulacion-aislada-ejemplo.html   ejemplo de simulación de usuario con el SDK
  tests/*.test.js · tests/sql/*     pruebas
```

### 3.2 Contrato común de simulación v1 (RF-11)

Una simulación se describe con un **manifiesto** (objeto JSON). `validarManifiesto()` lo valida y se puede usar igual en el navegador, en un editor (M5) o en una función de servidor.

| Campo | Regla |
|---|---|
| `contrato` | Debe ser `1`. |
| `clave` | Identificador de URL: minúsculas, números y guiones, 3–60. Único en la plataforma. |
| `nombre`, `descripcion` | 3–120 y 1–500 caracteres. |
| `instrucciones`, `teoria` | Texto plano (máx. 5 000 y 20 000). Se muestra como texto, nunca como HTML. |
| `tipo` | `visualizador`, `simulador`, `ejercicio` u `otro`. M3 lo usa como filtro (RF-07). |
| `runtime` | `integrada` (código del repositorio) o `aislada` (HTML de usuario en iframe aislado). |
| `entrada` | Integrada: clave del registro (`arboles-avl`). Aislada: URL `https` del HTML. |
| `vista` | Integrada: `arbol` (hoy la única). Aislada: `personalizada`. |
| `controles` | Subconjunto de `iniciar, pausar, reiniciar, paso, paso_atras, velocidad`. Debe incluir `reiniciar`. |
| `parametros` | Hasta 20: `{clave, etiqueta, tipo: entero\|decimal\|booleano\|opcion, min, max, opciones, defecto}`. |
| `acciones` | Hasta 10 acciones propias del dominio (p. ej. `insertar`) con hasta 8 campos cada una. |

**Instancia de una simulación integrada** (`crear()` devuelve un objeto con estos 7 métodos; `registro.js` lo verifica):
`frameActual()`, `posicion() → {indice,total}`, `avanzar() → bool`, `retroceder() → bool`, `reiniciar()`, `ejecutar(accion,args) → {ok,error?}`, `ajustar(parametros)`.

**Modelo de "frames".** Cada operación genera una lista de frames (estados dibujables). El visor solo avanza o retrocede por esa lista; así se obtienen, sin código extra por simulación, pausa, paso a paso, paso atrás y velocidad. El frame 0 de cada operación es el estado previo. Un frame de vista `arbol` es `{vista, arbol:{v,h,fb,i,d}, mensaje, regla, resaltados:{comparando,nuevo,desbalanceado,rotado}, opciones}`.

**Decisión:** los controles que no se declaran no se muestran ni se aceptan. El controlador valida **toda** acción y parámetro contra el manifiesto antes de llamar a la simulación.

### 3.3 Controlador estándar (RF-13)

`crearControlador(instancia, manifiesto, opciones)` devuelve `estado()`, `suscribir()`, `iniciar/pausar/reiniciar/paso/pasoAtras`, `ejecutar`, `setParametro`, `setVelocidad`, `exportarConfiguracion`, `importarConfiguracion`, `dispose`.

- Estados: `listo`, `reproduciendo`, `pausado` (hay pasos pendientes) y `error`. Una excepción de la simulación nunca rompe la página: pasa a `error` y `reiniciar()` lo recupera.
- `estado()` devuelve un objeto estable entre cambios, apto para `useSyncExternalStore` de React.
- El reloj es inyectable (`programador`), por eso es probable sin esperar tiempo real.
- Por defecto, al ejecutar una acción la animación arranca sola (`reproducirAlEjecutar: true`). **Decisión propuesta;** para modo "solo paso a paso" basta pasar `false`.
- Velocidad limitada a 100–3000 ms por paso.

### 3.4 Simulación de ejemplo: árboles AVL (RF-14)

`motor.js` es un motor puro (sin DOM). Inserta y elimina (hoja, un hijo, dos hijos con sucesor inorden), recalcula alturas y factor de balance (FB = altura izq − altura der), detecta los 4 casos (LL, RR, LR, RL) y emite un frame por comparación, inserción, desbalance y rotación, con el texto de la regla. Rechaza duplicados con un mensaje, sin error. Acciones: `insertar`, `eliminar`, `cargar_ejemplo` (árbol de 7 nodos; luego insertar 10 y 5 provoca una rotación). Parámetros: mostrar FB, mostrar altura. Rango de valores: −999 a 999.

Pruebas: los 4 casos de rotación, eliminación con rotación, y una prueba aleatoria de 3000 operaciones que comprueba tras cada una el orden BST, las alturas, el FB y que el contenido coincida con un `Set`.

### 3.5 Aislamiento de contenido de usuarios (RF-19, parte de M4)

Las simulaciones de usuario se ejecutan solo con `runtime = 'aislada'`, así:

1. **iframe con `sandbox="allow-scripts"`** sin `allow-same-origin`: origen opaco, sin acceso a cookies, `localStorage`, DOM ni sesión de Supabase de la página. Sin navegación del contexto superior, popups ni formularios.
2. **CSP** en una `<meta>` colocada antes del contenido del autor: `default-src 'none'`, `connect-src 'none'`, solo scripts y estilos en línea, imágenes y fuentes `data:`/`blob:`, `worker-src blob:`.
3. **Descarga controlada:** solo `https` y orígenes de una lista blanca (p. ej. Supabase Storage), sin cookies, sin redirecciones, máx. 2 MB.
4. **Protocolo `postMessage`** con canal y versión; el visor acepta mensajes únicamente si `event.source` es el iframe y `event.origin === 'null'`, y sanea cada campo (estados permitidos, enteros acotados, textos de máx. 300 caracteres).
5. **Las simulaciones `integradas` nunca se cargan desde datos:** el visor las resuelve solo contra el registro del código; la BD solo permite crearlas a un administrador.

**SDK** (`window.UniSim`, inyectado por el visor): `UniSim.registrar({iniciar, pausar, reiniciar, paso, paso_atras, parametro, accion, velocidad})`, `UniSim.estado({estado, indice, total, mensaje})`, `UniSim.error(msg)`. Ver `ejemplos/simulacion-aislada-ejemplo.html`.

El puente aislado expone **la misma interfaz que el controlador**, por lo que `ControlesEstandar` funciona igual para ambos tipos.

### 3.6 Página de simulación (RF-12) y datos

`PaginaSimulacion({supabase, clave, registro, origenesPermitidos, usuarioId, configId})`: carga la fila por `clave`, **revalida el manifiesto** (la BD no valida su estructura interna), llama a `registrar_vista` sin bloquear la página, y muestra nombre, descripción, instrucciones, visor, controles y teoría. Estados: cargando, no existe/no publicada, error. `registro` debe crearse **fuera** del componente (si no, el efecto se repite en cada render).

### 3.7 Base de datos

Migración `20261026000200_m4_simulaciones.sql` (ver §5). Decisiones:

- M4 **crea** `public.simulaciones`, que M6 había dejado como stub. Incluye los campos del contrato de M6 (`id`, `autor_id → perfiles`, `estado`) y los de M4.
- El cliente **no puede fijar `estado`** al crear: no tiene `GRANT INSERT` sobre esa columna; nace en `borrador`.
- Sin `UPDATE`/`DELETE` para clientes: los agrega M5 junto con las transiciones de estado.
- `integrada` solo la crea un administrador (RLS) y además el visor la ignora salvo clave del registro.

## 4. Interfaces con otros módulos

### M4 ofrece

- **Tabla `public.simulaciones`** y `public.simulacion_configuraciones`; función `public.obtener_configuracion(uuid)`.
- **Ruta propuesta:** `/simulacion/:clave` (el enrutador es de M6; M4 solo entrega el componente).
- **JS:** `validarManifiesto`, `aFilaSimulacion(manifiesto, autorId)`, `desdeFilaSimulacion(fila)`, `crearRegistro`, `crearControlador`, `crearPuente`, `prepararDocumentoAislado`, SDK `UniSim`.
- **Contrato con M6 cumplido:** `autor_id → perfiles(id)`, `estado` con valor `'publicada'`, y `registrar_vista(simulacion_id, token)` llamada al abrir la página con un token de 36 caracteres (M6 exige 16–128).

### M4 espera de los demás

- **M1:** `public.perfiles(id)`, `es_moderador()`, `es_administrador()` y `tocar_actualizado_en()` (esta última es una función genérica de la migración de M1; si la renombran, hay que avisar).
- **M2:** vincular simulación↔tema/asignatura con su propia tabla puente (RF-09), referenciando `simulaciones(id)`.
- **M3:** buscar sobre `nombre`, `descripcion`, `tipo`, solo con `estado = 'publicada'`.
- **M5:** transiciones de estado, políticas `UPDATE`/`DELETE`, versionado (RF-20), carga del HTML al almacenamiento, validación del manifiesto con `validarManifiesto` **también en servidor**, y límites contra spam de borradores.
- **M6 (interfaz):** enrutador, estilos (M4 trae `visor.css` neutro con variables CSS y modo oscuro) y el cliente de Supabase con clave pública.

## 5. Modelo de datos afectado

**`public.simulaciones`** — `id uuid pk`, `autor_id uuid → perfiles`, `clave text unique`, `nombre`, `descripcion`, `instrucciones`, `teoria`, `tipo`, `runtime`, `punto_entrada`, `contrato_version smallint`, `manifiesto jsonb` (máx. 64 KB), `estado text` (`borrador|en_revision|publicada|rechazada|retirada`), `creado_en`, `actualizado_en`. `CHECK` de formato por `runtime` en `punto_entrada`. Índices por autor, por `(estado, creado_en desc)` y por `tipo` (solo publicadas).
RLS: lectura pública de `publicada`; el autor ve las suyas; moderadores ven todas; `INSERT` solo a nombre propio y solo columnas de contenido.

**`public.simulacion_configuraciones`** — `id uuid pk` (no adivinable; funciona como enlace para compartir), `simulacion_id`, `usuario_id`, `nombre`, `estado jsonb` (máx. 16 KB), `compartida`, `creado_en`. Máx. 20 por usuario y simulación (trigger). RLS: cada usuario gestiona las suyas; crear solo sobre simulaciones publicadas; abrir una ajena solo con `obtener_configuracion(id)` y si está compartida. No hay listado público.

**Orden de aplicación propuesto:** M1 `20261026000100` → M4 `20261026000200` → M6 `20261026000300…`. Reversa en orden inverso. **Problema detectado:** M1 y M6 usan ambas el prefijo `0001_`, y Supabase CLI exige un prefijo único; el líder debe fijar la numeración definitiva.

## 6. Cómo probarlo

**JavaScript (hecho, 35/35):**
```bash
cd m4-visor && npm test        # requiere Node 20+; sin dependencias
```

**SQL (escrito, NO ejecutado):**
```bash
bash tests/sql/run_sql_tests.sh   # PostgreSQL 14+ y psql; usa las tablas REALES de M1 sobre stubs mínimos de Supabase
```
Cubre: creación en borrador, imposibilidad de fijar `estado`, suplantación, `integrada` sin ser administrador, URL no `https`, visibilidad (autor, otro usuario, moderador, anónimo), publicada visible, ausencia de `UPDATE`/`DELETE`, configuraciones compartidas y privadas, y aplicar → revertir → reaplicar. Si algo falla, es probable que sea un error del propio SQL o de la prueba: corregir y reportar.

**Manual en el navegador (pendiente):** con React/Vite, montar `PaginaSimulacion` con `crearRegistro(cargadores)`; comprobar AVL (insertar 10, 20, 30 → rotación), pausa y paso atrás, y cargar `ejemplos/simulacion-aislada-ejemplo.html` en un bucket para validar el iframe y la CSP.

## 7. Problemas conocidos y pendientes

1. **SQL sin ejecutar** (posibles errores de sintaxis o permisos). Es lo primero que hay que correr.
2. **React sin renderizar:** solo verificado por sintaxis. Puede haber errores de ejecución.
3. **Aislamiento no probado en navegadores reales.** Pendientes de verificar: que `srcdoc` + CSP por `<meta>` se comporte como se espera, que el `fetch` a Storage tenga CORS, y que `postMessage` con origen `null` funcione igual en móviles.
4. **Riesgos residuales de RF-19:** un iframe aislado puede navegarse a sí mismo y mostrar contenido externo (suplantación visual); no tiene acceso a datos del usuario, pero lo mitiga la moderación (M5). Un origen distinto para el contenido de usuarios (p. ej. un subdominio solo para simulaciones) daría una capa más; no se hizo.
5. **RNF-01 en simulaciones de usuario:** un iframe no garantiza un hilo separado. Una simulación pesada puede congelar la página; se recomienda a los autores usar `Worker` desde un `blob:` (la CSP lo permite). Falta medir con un prototipo (como pide el documento general).
6. **Solo hay una vista integrada (`arbol`)** y un ejemplo (AVL). Faltan vistas para listas, arreglos, grafos y colas; cada una es un componente en `VISTAS` y un valor en `VISTAS_INTEGRADAS`.
7. **RF-15 incompleto:** falta pantalla para listar, borrar y copiar el enlace de configuraciones; las simulaciones aisladas solo guardan parámetros (no acciones).
8. **No se muestra el autor** en la página (usaría `perfiles_publicos` de M1), ni el distintivo oficial (RF-21, M5 con `es_profesor()`).
9. Sin accesibilidad avanzada ni pruebas en móvil (RNF-04); el árbol grande se desplaza horizontalmente, sin zoom.
10. La aleatoriedad del token de vista usa `localStorage`; si el visitante lo bloquea, cada recarga cuenta como visitante nuevo ese día (afecta poco al conteo).

## 8. Cambios solicitados a otros módulos

- **Líder:** fijar la numeración de migraciones (M1 y M6 chocan en `0001`) y aprobar las decisiones de §3 (marcadas como propuesta).
- **M6:** reemplazar el stub de `simulaciones` por esta migración y **reprobar** (con RLS activa; sus funciones `SECURITY DEFINER` no deberían verse afectadas, pero hay que comprobarlo); confirmar que `registrar_vista` se llama desde `PaginaSimulacion` como espera; M6 también crea `simulacion_es_publica`, que M4 no usa a propósito para no depender del orden.
- **M1:** confirmar que `tocar_actualizado_en()` y `es_administrador()` son parte estable de su contrato; revisar la parte de RF-19 de §3.5 y decidir si el contenido aislado debe servirse desde otro origen.
- **M2:** crear la tabla puente simulación↔tema/asignatura.
- **M3:** definir si necesita columnas o índices de texto sobre `simulaciones` (hoy solo hay índices por `estado`, `tipo` y `autor_id`).
- **M5:** políticas `UPDATE`/`DELETE`, transiciones, versionado (¿`simulacion_versiones` con `manifiesto` y `punto_entrada` por versión?), subida del HTML a Storage, validación en servidor y límites de borradores por usuario.

## 9. Contexto para el siguiente integrante

M4 define **cómo se describe, carga y controla una simulación**. Toda simulación tiene un manifiesto v1 y es `integrada` (código del repositorio, registrada en `src/integradas/index.js`) o `aislada` (HTML de usuario en un iframe con `sandbox="allow-scripts"` y CSP estricta). Ambas se manejan con el mismo controlador y los mismos controles; el visor solo avanza o retrocede por una lista de *frames*. La tabla `simulaciones` ya existe en esta migración y **M4 es quien la crea**: M5 agrega estados, versiones y políticas de escritura; M2 y M3 la usan para catálogo y búsqueda; M6 ya cuenta con `autor_id` y `estado = 'publicada'`. No lea ni escriba `manifiesto` sin pasarlo por `validarManifiesto`. Nunca cargue una URL guardada en la BD fuera del iframe aislado. Lo primero por hacer: ejecutar `bash tests/sql/run_sql_tests.sh` y montar `PaginaSimulacion` en un proyecto Vite para ver AVL funcionando.
