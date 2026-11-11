# LPhoton — Especificación del proyecto

> Documento de referencia para el desarrollo. Cualquier decisión de diseño o de código debe respetar este archivo, la guía de estilos (`docs/guia-de-estilos.pdf`) y las maquetas (`docs/maquetas/`).
> Autores del diseño: Luis Barrios Urbina y Alan Troncoso Jara. Electivo I: Taller de UI y UX (UCM).

---

## 1. Qué es LPhoton

LPhoton es un **launcher de escritorio para PC (Windows)** que une en **una sola biblioteca** los juegos del usuario en **Steam, Epic Games y GOG**. Su foco está en el **rendimiento del sistema** (consumir pocos recursos) y en **respetar el tiempo del usuario**: no muestra publicidad ni ventanas emergentes, y permite iniciar un juego con la menor cantidad de clics.

**Problema que resuelve:** los jugadores con poco tiempo libre (estudiantes y profesionales jóvenes) lo pierden cerrando publicidad, lidiando con launchers pesados en segundo plano y buscando en foros cómo arreglar errores al iniciar un juego.

**Principios de diseño (de la guía de estilos):**
- **Eficiencia:** el bajo consumo de recursos tiene prioridad sobre los elementos visuales innecesarios.
- **Respeto por el tiempo del usuario:** navegación directa, sin publicidad ni pop-ups, con la menor cantidad de clics posible.

---

## 2. Requerimientos

### Funcionales
| # | Nombre | Descripción |
|---|--------|-------------|
| RF1 | Sincronización multiplataforma | Vincular las cuentas de Steam, Epic Games y GOG para extraer la biblioteca de juegos y su información complementaria (horas jugadas, descripciones, portadas, etc.). |
| RF2 | Ejecución intervenida | Al iniciar un juego con licencia comercial, abrir el cliente nativo (Steam/Epic/GOG) en **modo silencioso**, sin ventanas emergentes ni publicidad. |
| RF3 | Modo suspensión activa ("modo ligero") | Una vez validada la licencia mediante la ejecución intervenida, **bajar automáticamente la prioridad de CPU y el consumo de RAM** de los procesos secundarios (clientes nativos, webhelpers) para congelar su consumo. |
| RF4 | Comunidad | Pestaña con las **soluciones técnicas y mods de rendimiento más votados** para los juegos de la biblioteca del usuario. |

### No funcionales
| # | Nombre | Criterio medible |
|---|--------|------------------|
| RNF5 | Interfaz sin anuncios | No hay tienda integrada, banners de ofertas ni noticias. |
| RNF6 | Bajo consumo | Con LPhoton minimizado y el usuario jugando, el consumo de RAM de LPhoton debe ser **< 100 MB**. |
| RNF7 | Arranque inmediato | Desde que se ejecuta hasta que se muestra toda la biblioteca: **< 4 segundos**. |

---

## 3. Stack técnico

| Capa | Tecnología | Motivo |
|------|-----------|--------|
| Shell de escritorio | **Tauri 2** (backend en Rust) | Con Electron no se cumple el RNF6: solo en reposo ya usa más de 150 MB. Tauri usa el WebView2 del sistema y su backend en Rust permite manipular procesos de Windows. |
| Frontend | **React 18 + TypeScript + Vite** | |
| Estilos | **CSS Modules o Tailwind** con *design tokens* como variables CSS | Los tokens de la sección 5 son la única fuente de colores, tipografías y tamaños. |
| Estado | Zustand (liviano) | |
| Persistencia local | SQLite (`tauri-plugin-sql` o `rusqlite`) | Caché de la biblioteca para cumplir el RNF7. |
| Métricas del sistema | crate `sysinfo` | CPU y RAM en tiempo real (etiqueta de la ficha del juego). |
| Procesos en Windows | crate `windows` (Win32: `SetPriorityClass`, `EmptyWorkingSet`, `OpenProcess`) | Modo ligero (RF3). |
| Fuentes | Faster One, Chakra Petch, Montserrat, **incluidas en el bundle** (sin depender de Google Fonts en tiempo de ejecución) | Funcionamiento offline y arranque rápido. |

**Plataforma objetivo:** Windows 10/11 (x64). El código específico de Windows queda aislado en un módulo (`src-tauri/src/platform/windows.rs`) para no bloquear el desarrollo de la UI en otros sistemas.

**Prerrequisitos de desarrollo:** Node.js 20+, Rust (rustup, toolchain estable), Microsoft C++ Build Tools y WebView2 (ya viene en Windows 11).

---

## 4. Estructura de carpetas sugerida

```
lphoton/
├── LPHOTON.md                  ← este archivo
├── docs/
│   ├── anteproyecto.pdf
│   ├── guia-de-estilos.pdf
│   └── maquetas/
│       ├── 00-componentes-botones.png
│       ├── 01-biblioteca.png
│       ├── 02-ficha-juego.png
│       ├── 03-dialogo-optimizacion.png
│       └── 04-pantalla-carga.png
├── src/                        ← frontend React
│   ├── assets/fonts/           ← .ttf/.woff2 de las 3 fuentes
│   ├── assets/icons/           ← íconos de Steam, Epic, GOG, lupa, play
│   ├── styles/tokens.css       ← design tokens (sección 5)
│   ├── components/             ← Button, NavBar, Logo, GameCover, GameListItem, Dialog, Toast, ProgressBar, PlatformBadge
│   ├── screens/                ← Login, Library, GameDetail, Forums, Settings, Profile, LaunchScreen
│   ├── store/
│   └── lib/                    ← wrappers de los comandos de Tauri (invoke)
└── src-tauri/
    └── src/
        ├── main.rs
        ├── commands.rs         ← comandos expuestos al frontend
        ├── library/            ← steam.rs, epic.rs, gog.rs, merge.rs
        ├── launcher.rs         ← ejecución intervenida (RF2)
        ├── lightmode.rs        ← modo ligero (RF3)
        ├── metrics.rs          ← CPU/RAM
        ├── db.rs               ← caché SQLite
        └── platform/windows.rs
```

---

## 5. Sistema de diseño (guía de estilos)

### 5.1 Colores

| Token | Nombre | Hex | Rol |
|-------|--------|-----|-----|
| `--color-primary` | Morado velocidad | `#B636C7` | Identidad de marca y botones principales (**JUGAR**). |
| `--color-accent` | Celeste luz | `#00F0FF` | Enlaces, hover, detalles, texto de los botones de navegación. |
| `--color-alert` | Rosado señal | `#FF007F` | Notificaciones, alertas, botón **Omitir** y luces del fondo. |
| `--color-success` | Verde éxito | `#00E676` | Mensajes de éxito, botón **Activar modo ligero**, avisos de modo ligero activo. |
| `--color-deep` | Morado intenso | `#4A1550` | Alto contraste y textos sobre fondos claros. |
| `--color-bg-light` | Neutral claro | `#DBC5DD` | Fondo principal en modo claro. |
| `--color-bg-dark` | Neutral oscuro | `#2D1B36` | Fondo de contenedores en modo oscuro, fondo de los botones y del contenido. |
| `--color-navbar` | Lavanda (barra superior) | `#AF89C5` ⚠️ | Fondo de la barra de navegación según las maquetas. **No está definido en la guía**: se tomó de las maquetas; confirmarlo con el equipo de diseño. |

**Reglas de uso:**
- Todo par texto/fondo debe superar un contraste de **4.5:1** (WCAG AA).
- Pares aprobados: `#4A1550` sobre `#DBC5DD` y `#00F0FF` sobre `#2D1B36`.
- **Prohibido:** texto vibrante sobre fondo vibrante, y texto oscuro sobre fondo oscuro.
- La guía contempla **modo claro y modo oscuro**. Las maquetas muestran el oscuro, que será el predeterminado. El modo claro se implementa intercambiando los tokens.

### 5.2 Tipografías y roles de texto

| Rol | Fuente | Peso | Tamaño | Dónde |
|-----|--------|------|--------|-------|
| Display | **Faster One** | 400 | 75 px | Logo "LPhoton", pantalla de carga e insignias de marca. **Solo ahí.** |
| Título | **Chakra Petch** | 700 | 24 px | Secciones (Biblioteca, Foros, Configuraciones, Perfil), encabezados de ventanas y categorías. En los botones de la navbar va en mayúsculas y a menor tamaño (ver maqueta 00). |
| Cuerpo | **Montserrat** | 400 | 16 px | Descripciones de juegos, resúmenes de rendimiento e instrucciones. |
| Etiqueta | **Montserrat** | 600 | 12 px | Texto del botón JUGAR, métricas (`CPU: 1.2% • RAM: 74 MB • PLATAFORMA: STEAM`), metadatos (Género, Desarrollador…) y etiquetas de plataforma. |

### 5.3 Logo
- Texto "LPhoton" en Faster One, con degradado horizontal y las líneas de velocidad propias de la fuente.
- En fondo oscuro, el degradado **parte en Celeste `#00F0FF`** y pasa a Rosado/Morado. En fondo claro, **parte en Morado `#B636C7`**.
- En la navbar va dentro de una caja `#2D1B36` con bordes redondeados.
- **No** estirar, deformar, rotar ni cambiar la fuente.

### 5.4 Componentes (ver `docs/maquetas/00-componentes-botones.png`)

Todos los botones tienen bordes redondeados (~8 px) y texto en mayúsculas (salvo los del diálogo). Cada uno tiene **3 estados: normal, hover y deshabilitado/activo**.

| Componente | Normal | Hover | Deshabilitado / seleccionado |
|-----------|--------|-------|------------------------------|
| **Botón de navegación** (BIBLIOTECA, FOROS, CONFIGURACIONES, PERFIL) | Fondo `#2D1B36`, texto `#00F0FF` (Chakra Petch bold) | Sombra/brillo celeste en el borde inferior y derecho | Fondo morado grisáceo semitransparente y texto atenuado. **La pestaña activa de la navbar usa este estilo** (ver BIBLIOTECA en la maqueta 01). |
| **JUGAR** | Fondo `#B636C7`, ícono ▶ y texto oscuro `#2D1B36` | Sombra oscura desplazada (efecto elevado) | Fondo morado aclarado y opacidad reducida |
| **Omitir** | Fondo `#2D1B36`, texto `#FF007F` | Brillo rosado | Opacidad reducida |
| **Activar modo ligero** | Fondo `#2D1B36`, texto `#00E676` | Brillo verde/celeste | Opacidad reducida |
| **Lupa (búsqueda)** | Ícono de contorno `#00F0FF`, sin fondo | Brillo celeste | — |
| **Íconos de plataforma** | Logos pequeños de Steam / Epic / GOG junto al nombre del juego | — | — |

Las transiciones deben ser cortas (≤150 ms) y usar solo `transform`, `opacity` y `box-shadow` (eficiencia).

---

## 6. Pantallas

### 6.0 Barra de navegación (común a todas las pantallas)
Barra superior de fondo lavanda, que contiene de izquierda a derecha: **Logo** · **BIBLIOTECA** · **FOROS** · **CONFIGURACIONES** · **PERFIL** · **Lupa**. La sección activa usa el estilo "seleccionado". La lupa abre la búsqueda sobre la biblioteca.

### 6.1 Vinculación inicial / Login (prototipo en papel, sin maqueta digital)
- Formulario con **Usuario**, **Contraseña** y botón **Iniciar sesión**.
- Debajo, botones con los logos de **Steam, Epic Games y GOG** para vincular cuentas (RF1).
- Se muestra solo en el primer uso o mientras no haya ninguna plataforma vinculada.
- Se construye con los mismos tokens y componentes que el resto. Mensaje de ejemplo de la guía: *"Se han detectado 32 juegos en su biblioteca"*.

### 6.2 Biblioteca unificada — `docs/maquetas/01-biblioteca.png`
- **Panel izquierdo** (fondo `#2D1B36`, separado por una línea vertical): lista alfabética de todos los juegos, cada uno con su nombre (Montserrat, celeste, pequeño) y **los íconos de todas las plataformas donde el usuario lo tiene**. Si un juego está en dos tiendas (ej. *Resident Evil Requiem* en Epic y Steam), aparece **una sola vez con ambos íconos**. Encima de la lista van la búsqueda y los filtros (por plataforma, instalados y jugados recientemente).
- **Área derecha:** grilla de portadas verticales (proporción 2:3, ~600×900). Al pasar el mouse o tener el foco, la portada lleva un **borde celeste `#00F0FF`**. Un clic abre la ficha del juego.
- Debe aparecer en < 4 s (RNF7): se pinta primero desde la caché SQLite y se sincroniza en segundo plano. Las portadas se cargan con *lazy loading* y quedan en caché en disco.

### 6.3 Ficha del juego — `docs/maquetas/02-ficha-juego.png`
- Contenedor centrado con **borde celeste fino** y esquinas redondeadas.
- Arriba a la derecha, la etiqueta de métricas en vivo: `CPU: 1.2% | RAM: 74 MB | PLATAFORMA: STEAM` (Montserrat 600, 12 px, celeste). Corresponde al consumo de **LPhoton**.
- **Imagen hero** del juego (banner horizontal) ocupando la parte superior.
- Debajo, en tres columnas:
  1. Botón **▶ JUGAR**.
  2. Descripción del juego (Montserrat 16 px, celeste, truncada con "…").
  3. Metadatos en viñetas: Género, Desarrollador, Protagonista y Año de lanzamiento (Montserrat 600, 12 px).
- Según el prototipo en papel, también hay accesos a **Información**, **Comunidad** (soluciones) y **Mods**, todos dentro de la misma ficha.

### 6.4 Diálogo "¿Optimizar RAM?" — `docs/maquetas/03-dialogo-optimizacion.png`
- Aparece al pulsar JUGAR si se detecta un alto consumo del cliente nativo en segundo plano.
- El fondo (la ficha del juego) se **desenfoca** (`backdrop-filter: blur`).
- Modal `#2D1B36` con bordes redondeados:
  - Título **"¿OPTIMIZAR RAM?"** (Chakra Petch, celeste).
  - Texto: *"LPhoton detectó un alto consumo de recursos de Steam en segundo plano. ¿Deseas activar el modo ligero para cerrar los procesos innecesarios?"* (el nombre de la plataforma cambia según el juego).
  - Botones **Omitir** (rosado, a la izquierda) y **Activar modo ligero** (verde, a la derecha).
- En Configuraciones habrá una opción "Recordar mi elección" o "Activar siempre el modo ligero", para no preguntar cada vez (respeto por el tiempo del usuario).

### 6.5 Pantalla de carga "Iniciando juego optimizado" — `docs/maquetas/04-pantalla-carga.png`
- Pantalla completa sobre fondo `#2D1B36`, con **4 manchas de luz difusas** (2 celestes `#00F0FF` y 2 rosadas `#FF007F`) en los bordes. Se hacen con gradientes radiales en CSS, **sin imágenes pesadas ni animaciones costosas**.
- Al centro: logo **LPhoton** (Faster One), texto *"inicializando juego"* (celeste) y una **barra de progreso** (relleno celeste sobre una pista lavanda).
- Esquina superior izquierda: `FPS: Optimizados`. Esquina superior derecha: `Modo ligero activo` (etiquetas de 12 px).
- Abajo a la izquierda: tarjeta lavanda con la miniatura del juego, su nombre y *"Iniciando desde Steam"* junto al ícono de la plataforma.
- Abajo a la derecha: tarjeta con borde verde, *"Modo ligero activado"* y *"Procesos en segundo plano suspendidos"* (verde `#00E676`).
- La barra avanza según eventos reales del backend: cliente iniciado → licencia validada → proceso del juego detectado → modo ligero aplicado. Cuando el juego toma el foco, LPhoton se minimiza a la bandeja.

### 6.6 Foros / Comunidad (RF4)
- Lista de los juegos de la biblioteca. Al elegir uno, se muestran las **soluciones técnicas y mods de rendimiento ordenados por votos**, cada uno con título, descripción, votos y enlace.
- Fuente de datos inicial: **PCGamingWiki** (tiene una API pública Cargo con *fixes* por juego), cruzando los juegos por su AppID de Steam. Más adelante se puede agregar un backend propio con votación de usuarios.
- Mensaje de error de ejemplo de la guía: *"Error al sincronizar con Steam. Revisa la solución aquí →"*.

### 6.7 Configuraciones y Perfil
- **Configuraciones:** plataformas vinculadas (vincular/desvincular), rutas de instalación, modo ligero (preguntar / siempre / nunca), modo claro/oscuro, iniciar con Windows (**desactivado por defecto**; a los usuarios entrevistados les molesta esa opción).
- **Perfil:** nombre, plataformas vinculadas, total de juegos y horas jugadas sumadas de todas las plataformas.

---

## 7. Lógica de backend

### 7.1 Sincronización (RF1)
| Plataforma | Juegos instalados (local) | Biblioteca completa e info extra | Lanzamiento silencioso (RF2) |
|-----------|---------------------------|----------------------------------|------------------------------|
| **Steam** | Leer `steamapps/libraryfolders.vdf` y `appmanifest_*.acf` (ruta de Steam en el registro `HKCU\Software\Valve\Steam`) | **Steam Web API** `IPlayerService/GetOwnedGames` (requiere API key y SteamID64; devuelve horas jugadas). Portadas: CDN de Steam (`library_600x900.jpg`, `library_hero.jpg`). Descripciones: `store.steampowered.com/api/appdetails` | Iniciar `steam.exe -silent` si no está corriendo y luego `steam://rungameid/<appid>` |
| **Epic** | Manifiestos `C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests\*.item` | No hay API pública oficial: en el MVP se usan solo los juegos instalados (los manifiestos locales) | `com.epicgames.launcher://apps/<AppName>?action=launch&silent=true` |
| **GOG** | Base de datos de GOG Galaxy `C:\ProgramData\GOG.com\Galaxy\storage\galaxy-2.1.db` (SQLite) y archivos `goggame-*.info` en las carpetas de instalación | La misma base de Galaxy (incluye juegos no instalados y el tiempo de juego) | Los juegos de GOG no tienen DRM: se ejecuta directamente el `.exe` indicado en `goggame-*.info`, sin abrir Galaxy |

- **Fusión (`merge.rs`):** se normaliza el título (minúsculas, sin símbolos ni sufijos ™/®) y se unen los duplicados entre tiendas en un solo `Game` con una lista de `sources`.
- Todo queda en caché SQLite. Al abrir LPhoton se muestra la caché al instante y luego se sincroniza en segundo plano.
- Las credenciales y API keys se guardan con el gestor de credenciales de Windows (crate `keyring`), **nunca** en texto plano.

### 7.2 Ejecución intervenida (RF2)
1. Si el cliente nativo no está abierto, iniciarlo en modo silencioso (sin ventanas).
2. Lanzar el juego con el URI o comando de la plataforma.
3. Esperar a que aparezca el proceso del juego (comparando por ruta de instalación) y emitir eventos de progreso al frontend (pantalla 6.5).
4. Si el cliente abre alguna ventana visible (tienda, pop-up de ofertas), ocultarla.

### 7.3 Modo ligero (RF3)
Se aplica **después** de detectar el proceso del juego, lo que indica que la licencia ya fue validada:
- Procesos objetivo (lista configurable): `steamwebhelper.exe`, `EpicWebHelper.exe`, `GalaxyClient Helper.exe`, etc.
- Acciones: `SetPriorityClass(IDLE_PRIORITY_CLASS)` y `EmptyWorkingSet` para liberar la RAM de esos procesos.
- **No suspender** el proceso principal del cliente (`steam.exe`, `EpicGamesLauncher.exe`), porque se rompería el DRM, el guardado en la nube o el multijugador. Suspender por completo los *webhelpers* queda como opción **experimental**, desactivada por defecto.
- Al cerrar el juego se **restaura** la prioridad original de todo lo que se modificó.
- Requiere permisos sobre procesos del mismo usuario; si falla, avisar sin bloquear el inicio del juego.

### 7.4 Bajo consumo de LPhoton (RNF6)
- Al iniciar el juego, LPhoton se minimiza a la bandeja y **destruye su ventana WebView** (allí está casi todo el consumo de RAM). Solo sigue vivo el proceso Rust, que vigila el juego. La ventana se recrea al restaurar desde la bandeja.
- Medir: proceso de LPhoton y procesos WebView2 hijos sumados < 100 MB mientras se juega.

### 7.5 Arranque (RNF7)
- Ventana visible con la biblioteca cacheada en < 4 s. Nada de llamadas de red bloqueantes al arrancar.
- Medir el tiempo y registrarlo en el log (`startup_ms`).

---

## 8. Plan por fases

| Fase | Entregable | Criterio de "listo" |
|------|-----------|---------------------|
| **0. Base** | Proyecto Tauri + React + TS creado, fuentes incluidas, `tokens.css`, componentes base con sus 3 estados | Una página de muestra reproduce la maqueta 00 |
| **1. UI con datos simulados** | Navbar, Login, Biblioteca, Ficha, Diálogo, Pantalla de carga, con `mock-games.json` (saga Resident Evil como en las maquetas) | Cada pantalla coincide visualmente con su maqueta |
| **2. Steam** | Detección local + Web API, caché SQLite, lanzamiento silencioso | La biblioteca real de Steam se muestra y los juegos se inician |
| **3. Epic + GOG + fusión** | Lectores de Epic y GOG, deduplicación con varios íconos | Un juego presente en dos tiendas aparece una sola vez |
| **4. Ejecución intervenida + modo ligero** | `launcher.rs`, `lightmode.rs`, eventos de progreso, diálogo real, restauración al cerrar el juego | La RAM del cliente nativo baja al jugar y se restaura al salir |
| **5. Comunidad** | Pestaña Foros con datos de PCGamingWiki | Se muestran fixes ordenados para los juegos de la biblioteca |
| **6. Rendimiento y pulido** | Métricas en vivo, minimizar a bandeja y destruir el WebView, modo claro, Configuraciones y Perfil | RNF6 y RNF7 medidos y cumplidos |

---

## 9. Reglas para el desarrollo
- Sin tiendas, banners, noticias ni pop-ups no solicitados (RNF5).
- Colores, fuentes y tamaños solo desde los tokens; nada de hex sueltos en los componentes.
- Las imágenes de `docs/maquetas/` son la referencia visual definitiva. Ante una duda de diseño, se consultan ellas y la guía antes de inventar.
- Textos de la interfaz en **español**.
- Código, nombres de variables y commits en inglés; comentarios en español cuando ayuden.
- Cada fase termina con la app compilando, el linter limpio y una nota breve de lo hecho en `CHANGELOG.md`.
