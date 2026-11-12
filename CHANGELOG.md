# Changelog

## [0.10.0] – 2026-11-12 · Publicación gratuita: login con Steam y actualizaciones

### Iniciar sesión con Steam
- El login falso (aceptaba cualquier usuario y contraseña) se reemplaza por **Iniciar sesión con Steam** (OpenID 2.0, sin servidor propio). LPhoton abre la página oficial de Steam en el navegador, recibe la respuesta en un puerto local (127.0.0.1, puerto al azar) y la verifica con Steam (`check_authentication`) antes de aceptar la cuenta. Luego lee el nombre y el avatar públicos.
- La contraseña se escribe en steamcommunity.com, nunca en LPhoton. Cada intento lleva un valor aleatorio propio; se puede cancelar y caduca a los 5 minutos.
- Quien no usa Steam puede **continuar con un perfil local** (solo un nombre).
- Perfil: avatar y nombre de Steam, con **Cerrar sesión**. El inicio de sesión ahora es obligatorio para entrar a la biblioteca, además de vincular una plataforma.

### Actualizaciones automáticas
- LPhoton busca una versión nueva en GitHub 6 s después de abrir (no afecta el arranque) y muestra un aviso para **actualizar con un clic**. También en **Configuraciones → Acerca de → Buscar actualizaciones**.
- Los instaladores van firmados con la clave del proyecto y se verifican antes de instalarse (`tauri-plugin-updater`). Nuevo `scripts/updater-manifest.mjs` para generar `latest.json`.

### Publicación
- Licencia **MIT** (`LICENSE`).
- README: descarga desde el último release, cómo publicar una versión, privacidad del login y por qué las horas sin API key pueden no coincidir con Steam.

## [0.9.0] – 2026-11-12 · Rediseño inmersivo

La interfaz deja las maquetas originales y pasa a un launcher visual, al estilo de GOG Galaxy y Steam Big Picture. Sigue usando solo tokens, y las transiciones solo `transform`, `opacity` y `box-shadow`.

### Ambiente
- **Fondo negro azulado** (`#06070D`) en lugar del morado. Detrás de todo va el arte del **juego activo**, muy desenfocado, que cambia con un fundido de 800 ms (componente `Ambient`).
- El juego activo es el último bajo el cursor o con el foco (en la grilla o en la lista), el de la ficha abierta o el elegido en Foros. Al abrir, es el jugado más recientemente.
- El desenfoque se calcula una vez por imagen y el cambio es solo de opacidad. Pasar el cursor por varias portadas camino a otra no cambia el fondo (espera 110 ms).

### Paneles de vidrio
- **Barra superior** y **panel lateral** flotan sobre el ambiente como vidrio oscuro translúcido, con filo de 1 px y esquinas de 18 px. La barra baja de 96 a 64 px; las secciones son pestañas con un subrayado de neón en la activa.
- La ficha, las tarjetas de Configuraciones y Perfil, el panel de Foros y el Login usan el mismo vidrio.
- El panel lateral muestra una **miniatura** de cada portada; solo se desplaza la lista, los filtros quedan fijos.

### Portadas
- Bajo el cursor la portada **crece un 6 %** (260 ms) y muestra el nombre, el **tiempo jugado**, los **íconos de sus tiendas** y un botón **JUGAR** celeste (INSTALAR si no está instalada).
- JUGAR lanza el juego **desde la biblioteca**, con la misma pregunta del modo ligero que la ficha (`useLaunchFlow`). INSTALAR lleva a la ficha, donde se sigue la descarga.
- La portada del juego activo lleva un **borde de neón celeste→rosado** con su resplandor, los colores del logo.
- Las portadas sin instalar se ven apagadas y se encienden bajo el cursor.

### Ficha del juego
- El nombre va en grande sobre el banner; debajo, JUGAR con resplandor, la descripción y los datos en dos columnas (etiqueta y valor). En ventanas de menos de 1100 px los datos pasan a una fila.

### Detalles
- JUGAR y los botones principales pasan de morado a **celeste con sombra dura rosada**.
- Los nombres de juegos y títulos usan un blanco frío (`--text-primary`); el celeste queda para lo activo y los enlaces.
- Barras de desplazamiento finas y sin flechas. El contenido se desenfoca más bajo los diálogos.
- El modo claro conserva todo el rediseño con vidrio claro.
- Modo demo: los banners de muestra ya no repiten el título, porque la ficha lo escribe encima (igual que con el arte real de las tiendas).
- README: capturas nuevas en `docs/capturas-0.9/` (las anteriores siguen en `docs/capturas/`) y enlace de descarga del instalador.
- Tokens nuevos: `--palette-void`, `--palette-ink`, `--text-primary`, `--glass-bg`, `--glass-bg-strong`, `--glass-filter`, `--glass-edge`, `--ambient-*`, `--neon-ring`, `--neon-glow`, `--shadow-cover`, `--radius-xl`, `--shell-gap`, `--duration-smooth`, `--duration-ambient`, `--ease-soft`, `--scrollbar-thumb`.

## [0.8.0] – 2026-11-12 · Mejoras de interfaz

Pulido general sin salir de la guía de estilos: mismos colores, tipografías y componentes. Las transiciones siguen usando solo `transform`, `opacity` y `box-shadow` (≤150 ms).

### La interfaz crece con la ventana
- Los tamaños de texto parten de los valores de la guía (24 / 16 / 12 px) y crecen un poco en ventanas grandes (`clamp`). A 1280 px todo se ve igual que en las maquetas; maximizado ya no queda diminuto.
- **Biblioteca**: las portadas ocupan todo el ancho disponible (4 columnas a 1280 px, 5 a 1920 px) en vez de 3 columnas fijas con márgenes vacíos. El panel izquierdo también se ensancha.
- **Ficha**: crece hasta 1280 px de ancho, pero nunca más de lo que cabe a lo alto, para que JUGAR quede siempre a la vista.
- **Configuraciones, Perfil y Foros**: la columna de contenido se ensancha con la ventana.

### Biblioteca
- Al pasar el mouse (o con el foco del teclado), la portada se eleva y muestra una franja con el **nombre del juego y sus tiendas**.
- Los juegos **sin instalar** llevan una marca de descarga en la portada y se ven atenuados en la lista, para ubicar rápido los que ya se pueden jugar.
- El contador de juegos se ve siempre, no solo con filtros activos.
- Estado vacío en el área de portadas ("Ningún juego coincide" + "Ver toda la biblioteca") y silueta de la grilla mientras carga.
- **Ctrl+K** o **Ctrl+F** abren la búsqueda desde cualquier pantalla.

### Ficha del juego
- Muestra el **nombre del juego** y los íconos de sus tiendas sobre la descripción. Las imágenes de Steam no traen el título, así que antes no se veía en ninguna parte.

### Configuraciones y Perfil
- Cada sección es una **tarjeta**, y en ventanas de 1200 px o más hay un **índice lateral** para saltar entre secciones (marca la que está a la vista).
- Los textos de ayuda usan el neutral claro `#DBC5DD` (nuevo token `--text-muted`, contraste de 8.9:1 o más) para distinguirse de los títulos y controles, que siguen en celeste. En modo claro usa el morado intenso atenuado (5.4:1 o más).
- Perfil: inicial del usuario junto al nombre y una barra proporcional a las horas en "Más jugados".
- Corregido: el ícono de Epic Games desaparecía cuando el botón de plataforma quedaba angosto.

### Detalles
- Entrada suave (150 ms) al cambiar de pantalla.
- Las filas de las listas se resaltan al pasar el mouse.
- Tokens nuevos: `--text-muted`, `--surface-raised`, `--surface-hover`, `--cover-scrim`, `--cover-min`, `--page-width`, `--shadow-row-active`.

## [0.7.0] – 2026-11-11 · Instalar juegos y barra responsiva

### Instalar juegos no instalados
- La ficha de un juego que no está instalado muestra **INSTALAR** (mismo estilo que JUGAR, con un ícono de descarga) en lugar de JUGAR.
- LPhoton no descarga nada por su cuenta: abre la instalación en el cliente de la tienda.
  - **Steam**: `steam://install/<appid>` (Steam pregunta en qué carpeta instalar).
  - **Epic**: `com.epicgames.launcher://apps/…?action=install`.
  - **GOG**: `goggalaxy://openGameView/<id>`.
- **Progreso real en Steam**: la ficha lee el `appmanifest_<appid>.acf` cada 2 s y muestra "En cola" o "Descargando 40 % · 3,2 GB de 8 GB" con una barra de progreso. Si una descarga empezó en Steam, la ficha la muestra al abrirse. Al terminar, la biblioteca se vuelve a sincronizar sola y aparece JUGAR.
- En Epic y GOG (que no exponen el progreso), la biblioteca se vuelve a sincronizar al regresar a LPhoton.
- Backend: comandos `install_game` e `install_status`. 30 tests (antes 29).

### Barra superior responsiva
- El logo queda pegado a la izquierda, las secciones se centran en el espacio que sobra y la lupa queda a la derecha. Antes todo se agrupaba al medio al maximizar.
- El logo, su caja y los botones de navegación crecen con el ancho de la ventana (`clamp`), de 1024 px a pantallas grandes.

## [0.6.0] – 2026-11-11 · Fase 6: Rendimiento y pulido

### Configuraciones (§6.7)
- **Plataformas vinculadas**: vincular y desvincular. Debe quedar al menos una.
- **Modo ligero**: *Preguntar*, *Siempre* o *Nunca*, con una explicación de cada opción. Así se cumple el "Recordar mi elección" del diálogo ¿Optimizar RAM? (§6.4).
- **Procesos que se aligeran**: lista editable (agregar, quitar y restaurar los predeterminados). Se rechazan los procesos principales de los clientes (`steam.exe`, `EpicGamesLauncher.exe`, `GalaxyClient.exe`), que nunca se modifican.
- **Apariencia**: tema oscuro (predeterminado) o claro.
- **Iniciar con Windows**: **desactivado por defecto**. Al activarlo se registra en `HKCU\…\Run` con `--tray`, así que LPhoton arranca solo en la bandeja, sin crear la ventana ni el WebView.
- **Rutas de instalación**: las carpetas de juegos detectadas en Steam, Epic y GOG, cuántos juegos hay en cada una y un botón "Abrir carpeta". Solo se abren las rutas detectadas.
- **Acerca de**: versión, sin anuncios.

### Perfil (§6.7)
- Nombre editable, plataformas, total de juegos, instalados y horas jugadas sumadas de todas las tiendas.
- Tabla por plataforma (juegos, instalados, horas) y los 5 juegos más jugados, con enlace a su ficha.

### Modo claro (§5.1)
- Se intercambian los tokens: el neutral claro `#DBC5DD` pasa a ser el fondo y el morado intenso `#4A1550` el texto (par aprobado). El logo usa el degradado que parte en morado (§5.3).
- El verde y el rosado se oscurecen en modo claro (`#00592F` y `#A3004F`) para mantener 4.5:1. Los originales sobre el fondo claro no llegan.
- La pantalla de carga sigue siempre oscura, como la maqueta 04.
- El tema se aplica antes del primer pintado, sin parpadeo.

### Rendimiento
- `docs/rendimiento.md` documenta las mediciones reales del log:
  - **RNF7**: 0,6–1,8 s hasta mostrar la biblioteca, con hasta 159 juegos. Meta: < 4 s.
  - **RNF6**: 35–45 MB mientras se juega. Meta: < 100 MB.
  - Modo ligero: 762 MB liberados.

### Otros
- Se quitaron los avisos "Sección en construcción".
- Backend: nuevo módulo `system.rs` y los comandos `get_autostart`, `set_autostart`, `install_paths` y `open_install_path`. 29 tests (antes 27).

## [0.5.0] – 2026-11-11 · Fase 5: Comunidad

### Decisión de diseño
- La especificación (§6.6) proponía leer los *fixes* desde la API Cargo de **PCGamingWiki**. Hoy esa API responde a los clientes automáticos con un **desafío anti-bots de Cloudflare**, y eludirlo no corresponde. Además, PCGamingWiki **no tiene votos**. Por decisión del usuario se combinan dos cosas:
  1. **Enlace directo a PCGamingWiki** por juego, que se abre en el navegador del sistema (por AppID de Steam con `api/appid.php`; si no, búsqueda por título).
  2. **Soluciones y mods propios, ordenados por votos**, guardados en el equipo (SQLite).
- Si más adelante PCGamingWiki da acceso a su API (canal oficial), sus soluciones se podrán mostrar dentro de LPhoton.

### Backend (Rust)
- Tabla `community_fixes` (juego, tipo *fix*/*mod*, título, descripción, enlace, votos, fecha) con índice por juego.
- Comandos `list_fixes` (ordenados por votos y luego los más nuevos), `fix_counts`, `add_fix`, `vote_fix` (±1, normalizado) y `delete_fix`.
- Validación en `community.rs`: título obligatorio (≤ 120), descripción ≤ 2000 y enlaces solo `http(s)://`, para rechazar `javascript:`, `file:` y similares.
- 27 tests unitarios (antes 24).

### Frontend
- **Foros**: a la izquierda tus juegos, con buscador y la cantidad de soluciones guardadas por juego. A la derecha, el juego elegido con:
  - Botón **"Ver soluciones y mods en PCGamingWiki →"**.
  - **"Mis soluciones y mods"**: tarjetas con votos ▲/▼, tipo (*Solución técnica* en celeste, *Mod de rendimiento* en verde), descripción, "Abrir enlace →" y eliminar con confirmación.
  - Formulario "+ Agregar solución" (tipo, título, descripción, enlace opcional) con mensajes claros.
- **Ficha del juego**: enlace "Soluciones y mods →" que abre Foros con ese juego seleccionado (§6.3, acceso a Comunidad desde la ficha).
- En el modo demo del navegador las soluciones se guardan en localStorage.

### Verificación
- `cargo test` ✔ (27) · `npx tsc -b` ✔ · `npm run lint` ✔.
- Modo demo: desde la ficha de *Resident Evil Requiem* → Foros con el juego seleccionado; dos soluciones agregadas, votos y reordenamiento correctos, contador "2" en la lista, enlace `javascript:` rechazado, sin errores de consola.

### Limitaciones
- Los votos son **solo tuyos y de este equipo**. Compartirlos entre usuarios requiere un backend propio (fuera del alcance del MVP).

## [0.4.0] – 2026-11-11 · Fase 4: ejecución intervenida, modo ligero y bandeja

### Backend (Rust)
- **Progreso real del lanzamiento** (`launcher.rs`): un hilo vigila los procesos con `sysinfo` y emite `launch-progress`:
  1. *client-started*: `steam.exe` / `EpicGamesLauncher.exe` está abierto (GOG no lo necesita).
  2. *license-validated*: aparece un proceso dentro de la carpeta de instalación del juego.
  3. *game-detected*: sigue vivo 3 s (si era un lanzador intermedio, como EasyAntiCheat, espera el proceso definitivo).
  4. *light-mode-applied*: con los MB liberados.
  También emite `launch-done` (*playing* o *handoff*, cuando el juego no está instalado y el cliente se hace cargo) y `launch-error` con mensajes claros.
- **Modo ligero real** (`lightmode.rs`, `platform/windows.rs`): `SetPriorityClass(IDLE)` + `EmptyWorkingSet` sobre los procesos auxiliares (`steamwebhelper.exe`, `EpicWebHelper.exe`, `GalaxyClient Helper.exe`, `GalaxyCommunication.exe`). La lista es configurable (SQLite, `lightmode_targets`).
  - **Nunca** se tocan `steam.exe`, `EpicGamesLauncher.exe`, `GalaxyClient.exe` ni LPhoton, aunque se agreguen a la lista.
  - Cada 30 s se aplica a webhelpers nuevos. Al cerrarse el juego (5 s sin procesos) **se restaura la prioridad original**, comprobando pid y hora de inicio para no tocar un proceso que reutilizó el mismo pid.
  - **Recuperación ante cierres inesperados**: los procesos modificados se guardan en SQLite y, si LPhoton se cierra de golpe, se restauran al volver a abrirlo.
- **Diálogo "¿Optimizar RAM?" con medición real** (`check_client_load`): suma la RAM del cliente y sus auxiliares; aparece desde 300 MB.
- **Bandeja del sistema** (`tray.rs`): el ícono está siempre presente, como en Steam.
  - Al empezar a jugar, la ventana se **destruye** (libera el WebView2) y LPhoton queda en la bandeja. Lo mismo al cerrar la ventana con la X.
  - Clic en el ícono o en "Abrir LPhoton": se recrea la ventana. "Salir" restaura el modo ligero y cierra.
- **Instancia única** (`tauri-plugin-single-instance`): abrir LPhoton de nuevo muestra la ventana existente.
- **Métricas reales** en la ficha (`get_app_metrics`): CPU y RAM de LPhoton más sus procesos WebView2.
- Se registran en `lphoton.log`: `lightmode_applied`, `ram_playing_mb`, `session_end` y `lightmode_recovered`. `startup_ms` se mide una sola vez por proceso.
- **Instalador de Windows** (NSIS, por usuario, en español, sin permisos de administrador): `npm run tauri build`.

### Frontend
- La pantalla de carga sigue los eventos reales y muestra *"Se liberaron N MB de RAM para mejorar tus FPS."* (tono de la guía), los errores, o *"Continúa en Steam…"* si el juego no está instalado.
- **Botón "‹ Volver"** en la ficha del juego (y tecla Esc). Vuelve a la biblioteca con su búsqueda y filtros.

### Mediciones (equipo real)
- **RF3 – Modo ligero**: *God of War Ragnarök* (Steam): 10 procesos ajustados, 0 fallos, **762 MB liberados**. En la prueba manual (`real_lightmode`), 10 procesos ajustados, 348 MB liberados y los 10 restaurados a su prioridad original (verificado uno por uno).
- **RNF6 – Bajo consumo**: con LPhoton en la bandeja y el juego abierto, **42 MB** (*Dead by Daylight*) y **45 MB** (*God of War Ragnarök*). Meta: < 100 MB. Sin procesos WebView2 hijos mientras se juega.
- **RNF7 – Arranque**: 344–1433 ms en modo desarrollo (meta: < 4000 ms).

### Verificación
- `cargo test` ✔ (24 + 4 manuales: Steam, Epic, API de GOG, modo ligero real) · `npx tsc -b` ✔ · `npm run lint` ✔.
- Prueba de punta a punta por el usuario: Dead by Daylight (sin modo ligero) y God of War Ragnarök (con modo ligero).

### Incidente corregido
- Durante las pruebas, `tauri dev` reinició LPhoton por un cambio de código mientras se jugaba, y los webhelpers quedaron en prioridad *Idle*. Se restauraron manualmente y, para que no vuelva a pasar, se agregó la recuperación desde SQLite al arrancar.

## [0.3.0] – 2026-11-11 · Fase 3: Epic, GOG y fusión

### Backend (Rust)
- **Epic Games** (`library/epic.rs`): lee los manifiestos `%ProgramData%\Epic\EpicGamesLauncher\Data\Manifests\*.item`. Solo cuenta juegos (`AppCategories` incluye `games`) y descarta aplicaciones como Discord, DLC e instalaciones incompletas. Lanzamiento silencioso con `com.epicgames.launcher://apps/<ns>%3A<item>%3A<app>?action=launch&silent=true`, validando el identificador para evitar inyección en la URI.
- **GOG** (`library/gog.rs`):
  - Base de GOG Galaxy `galaxy-2.1.db`, leída desde una **copia temporal** para no bloquear Galaxy: títulos, biblioteca (solo releases `gog_`), minutos jugados, última sesión e instalados. Las consultas toleran tablas faltantes de otras versiones de Galaxy.
  - Registro `HKLM\SOFTWARE\WOW6432Node\GOG.com\Games`: también detecta juegos de instaladores offline, sin Galaxy.
  - Lanzamiento **directo del .exe** según la `playTask` principal de `goggame-<id>.info` (ruta, argumentos y carpeta de trabajo), sin abrir Galaxy.
  - API pública v2 (`api.gog.com/v2/games/<id>`): portada vertical, fondo, género, desarrollador y año.
- **Fusión** (`merge.rs`): el mismo título normalizado en varias tiendas queda como **un solo juego con varias `sources`**. Steam se procesa primero para conservar su id y su portada.
- Protocolo `cover://` ampliado a GOG (`/gog/<id>/cover|hero`), con caché en disco igual que Steam.
- `get_game_details` recibe plataforma + id y elige la fuente: Steam → appdetails, GOG → API v2, Epic → sin datos (no hay API pública).
- Nuevo comando `platforms_status` (qué clientes están instalados). Cada lanzamiento queda en `lphoton.log` (`launch platform=… id=… ok|error`).
- 17 tests unitarios (antes 11): manifiestos de Epic, URI de lanzamiento, base de Galaxy sintética, `goggame-*.info`, fechas de Galaxy, fusión entre tiendas. Además, pruebas manuales `real_epic` y `real_gog_api` (`cargo test real_ -- --ignored --nocapture`).

### Frontend
- Se pueden vincular **Epic y GOG** en Login y Configuraciones, verificando que el cliente o sus juegos existan en el equipo. Si no, aparece un mensaje claro.
- **Filtros del panel izquierdo** (§6.2): por plataforma (solo las vinculadas), *Instalados* y *Recientes* (últimos 30 días), con un conteo y la opción "Quitar filtros". Se recuerdan entre sesiones.
- **Aviso de plataformas sin vincular**: si LPhoton detecta Epic o GOG instalados con juegos y no están vinculados, la biblioteca muestra *"Encontramos N juegos de Epic Games en este equipo. Vincular →"* (un clic) o *"Ahora no"* (no vuelve a aparecer).
- Portadas y detalles con prioridad Steam → GOG → Epic. Los juegos solo de Epic usan el placeholder sin hacer pedidos de red.

### Verificación
- `cargo test` ✔ (17) · `npx tsc -b` ✔ · `npm run lint` ✔ · `npm run build` ✔.
- Equipo real: Epic detectado (Fortnite sí, Discord descartado). En la app, Fortnite aparece con su ficha "PLATAFORMA: EPIC GAMES". GOG no está instalado en este equipo: la lectura se verificó con una base de Galaxy sintética y la API real de GOG (The Witcher: portada, fondo, género, desarrollador y año correctos).
- Modo demo: *Resident Evil Requiem* aparece una sola vez con los íconos de Epic y Steam, y el filtro "Epic Games" lo muestra solo a él.

### Limitaciones conocidas
- **Epic** no tiene API pública: sin portada (placeholder), sin descripción, sin horas jugadas ni última sesión. Por eso sus juegos nunca entran en "Recientes".
- La descripción de GOG llega en inglés (la API no la traduce). El género sí viene en español.
- El lanzamiento de juegos de GOG no se probó en un equipo real (no hay juegos de GOG instalados aquí).

## [0.2.0] – 2026-11-11 · Fase 2: Steam

### Backend (Rust)
- **Detección local sin red** (`library/steam.rs`): ruta de Steam en el registro (`HKCU\Software\Valve\Steam`), todas las bibliotecas de `libraryfolders.vdf`, juegos de `appmanifest_*.acf` (instalado = bit 4 de `StateFlags`) y horas/última sesión de `userdata/<id>/config/localconfig.vdf`. Se filtran redistribuibles, Proton y runtimes.
- **SteamID64 automático**: se toma de la sesión activa (`ActiveProcess\ActiveUser`) o de `loginusers.vdf`. El usuario no tiene que buscarlo.
- **Steam Web API opcional** (`GetOwnedGames`): con API key se agregan los juegos no instalados y las horas exactas. Sin key, la app funciona con los instalados.
- **API key en el administrador de credenciales de Windows** (`credentials.rs`, crate `keyring`). Se valida el formato y se prueba contra la API antes de guardarla. Nunca se escribe en disco ni en localStorage.
- **Caché SQLite** (`db.rs`, `lphoton.db` en la carpeta de datos de la app): biblioteca y detalles de la tienda (TTL de 30 días).
- **Detalles del juego** desde `store.steampowered.com/api/appdetails` en español (descripción, género, desarrollador, año), pedidos solo al abrir la ficha.
- **Protocolo `cover://`** (`covers.rs`) para portadas y banners: caché propia → caché del cliente de Steam (`appcache/librarycache`) → CDN de Steam (y se guarda en disco). Si no hay imagen, el frontend muestra un placeholder con el título.
- **Lanzamiento real** (`launcher.rs`): `steam.exe -silent` si Steam no está abierto y luego `steam://rungameid/<appid>`, sin ventanas de consola.
- **Medición de arranque** (RNF7): `setup_ms` y `startup_ms` (hasta que la biblioteca está pintada) se registran en `lphoton.log` (carpeta de logs de la app).
- Parser propio de VDF (`library/vdf.rs`), `merge.rs` ya integrado en el flujo y modelos serializados en `models.rs`.
- 11 tests unitarios (`cargo test`) + una prueba manual contra la instalación real (`cargo test real_steam -- --ignored --nocapture`).

### Frontend
- Los wrappers de `src/lib/` llaman a los comandos de Rust dentro de la app de escritorio. En el navegador (`npm run dev`) siguen usando los datos simulados (modo demo).
- La biblioteca se pinta primero desde la caché y se sincroniza en segundo plano. Si la Web API falla, se muestra el aviso de la guía: *"Error al sincronizar con Steam… Revisa la solución aquí →"*.
- Formulario de API key (opcional) en Login y en Configuraciones, con enlace para obtenerla, que se abre en el navegador del sistema (`tauri-plugin-opener`).
- Epic y GOG aparecen como "Próximamente" en la app de escritorio (fase 3).
- La ficha carga sus detalles desde la tienda y agrega "Tiempo jugado". Las líneas sin datos (p. ej. "Protagonista", que Steam no entrega) se ocultan.
- La pantalla de carga muestra el error si Steam no se pudo abrir, y se evita lanzar el juego dos veces si la pantalla se vuelve a montar.

### Mediciones
- **RNF7 – Arranque**: `startup_ms=1071` con 31 juegos (meta: < 4000 ms), en modo desarrollo (`tauri dev`, sin optimizar).

### Verificación
- `cargo test` ✔ (11) · `npx tsc -b` ✔ · `npm run lint` ✔ · `npm run build` ✔.
- Probado contra la instalación real de Steam: 3 bibliotecas, 31 juegos, SteamID detectado, portadas reales y detalles en español.

### Pendiente / limitaciones conocidas
- Algunos juegos recientes no tienen `library_600x900.jpg` en la ruta pública del CDN (Steam ahora usa URLs con hash): muestran el placeholder si el cliente de Steam tampoco las tiene en caché.
- Steam no distingue en los manifiestos entre juegos y aplicaciones (p. ej. *Wallpaper Engine*, *Lossless Scaling* aparecen en la biblioteca). Se podría filtrar con el campo `type` de `appdetails` u ofrecer "ocultar juego".
- Los pasos de progreso de la pantalla de carga siguen simulados (eventos reales en la fase 4).
- La prueba con API key no se hizo en esta sesión (requiere tu key); la ruta sin key está verificada.

## [0.1.0] – 2026-11-11 · Fases 0 y 1

### Fase 0 – Base
- Proyecto **Tauri 2 + React 18 + TypeScript + Vite** con **Zustand** y React Router; estructura de carpetas según LPHOTON.md §4.
- Fuentes **Faster One, Chakra Petch y Montserrat** incluidas como `.woff2` locales en `src/assets/fonts` (subconjunto latino, cubre á é í ó ú ñ ¿ ¡), con sus licencias OFL. No se usa Google Fonts.
- `src/styles/tokens.css`: todos los tokens de §5 (paleta, roles semánticos, fuentes, tamaños por rol, radios, sombras, duraciones, espaciado) y el cambio a modo claro con `data-theme="light"`. Ningún componente usa hex sueltos (comprobado con grep).
- Componentes base con sus 3 estados: `NavButton`, `PlayButton`, `SkipButton`, `LightModeButton`, `SearchIcon`, `PlatformBadge` (Steam/Epic/GOG), `Logo` (degradado celeste→rosado→morado, caja oscura); además `NavBar`, `GameCover`, `GameListItem`, `Dialog`, `ProgressBar`, `Toast` y `PlatformLinkButton`.
- Ruta **`/dev/componentes`**, que reproduce la maqueta 00 (los hover se fuerzan con `previewState="hover"`).
- Backend Rust: esqueleto de módulos (`commands`, `db`, `launcher`, `lightmode`, `metrics`, `library/{steam,epic,gog,merge}`, `platform/windows`), `tauri.conf.json` (ventana de 1280×800, CSP restrictiva), capacidades e íconos de la app.
- ESLint 9 (flat config) + `tsc -b` en modo estricto.

### Fase 1 – Interfaz con datos simulados
- `src/mock/mock-games.json`: 14 juegos de Resident Evil. *Resident Evil Requiem* está en **Epic y Steam** (aparece una sola vez, con ambos íconos).
- Portadas (600×900) y banners (1600×620) de muestra en SVG, generados localmente con `node scripts/generate-placeholders.mjs` a partir de la paleta. No se descargó arte con copyright.
- Wrappers en `src/lib/` (`library`, `accounts`, `launcher`, `lightmode`, `metrics`) que hoy devuelven datos simulados. Sus firmas ya son asíncronas, así que en las fases 2 a 4 solo cambia el cuerpo (por `invoke`/`listen`) y la UI no se toca.
- Pantallas:
  - **Login / vinculación** (§6.1): usuario, contraseña, botones de Steam/Epic/GOG y el mensaje "Se han detectado N juegos en su biblioteca". Solo aparece mientras no haya plataformas vinculadas.
  - **Biblioteca** (maqueta 01): lista alfabética con íconos por plataforma, grilla 2:3 con borde celeste en hover/foco, *lazy loading* y búsqueda desde la lupa.
  - **Ficha** (maqueta 02): métricas CPU/RAM simuladas que se actualizan cada 2 s, hero, JUGAR, descripción truncada y metadatos.
  - **Diálogo "¿Optimizar RAM?"** (maqueta 03): `backdrop-filter: blur` solo sobre el contenido (la navbar queda nítida), foco atrapado y Esc para cerrar. El nombre de la plataforma cambia según el juego.
  - **Pantalla de carga** (maqueta 04): 4 luces con gradientes radiales y progreso por pasos simulados (cliente → licencia → proceso → modo ligero).
  - **Foros, Configuraciones, Perfil**: estructura básica con el aviso "en construcción". Configuraciones ya permite vincular y desvincular plataformas; Perfil suma juegos y horas.
- Flujo completo: Biblioteca → portada → Ficha → JUGAR → Diálogo → (Omitir | Activar modo ligero) → Pantalla de carga. La preferencia de modo ligero (`ask`/`always`/`never`) ya existe en el store y se respeta al pulsar JUGAR.
- Animaciones de ≤150 ms, solo con `transform`, `opacity` y `box-shadow`. Se respeta `prefers-reduced-motion`.

### Verificación
- `npx tsc -b` ✔ · `npm run lint` ✔ · `npm run build` ✔ (JS 208 kB / 69 kB gzip).
- Flujo recorrido en Edge headless a 1280×800, sin errores de consola. Las capturas están en `docs/capturas-fase1/`.
- ⚠ **`npm run tauri dev` no se pudo ejecutar en esta máquina**: no hay Rust ni el componente C++ (MSVC + Windows SDK) de Visual Studio (`npx tauri info`). Por eso el código Rust **no está compilado**. Es mínimo a propósito: solo `lib.rs`/`main.rs` estándar de Tauri 2, un comando `app_version` y módulos documentados.

### Decisiones tomadas
- **Contraste de JUGAR y Omitir**: por decisión del equipo se mantienen como en la maqueta, aunque no llegan a 4.5:1. JUGAR (`#2D1B36` sobre `#B636C7`) da 3.28:1 y Omitir (`#FF007F` sobre `#2D1B36`) da 4.21:1. Con la misma excepción se usa el rosado en los mensajes de error.
- **Pestaña activa de la navbar**: usa el estilo "seleccionado" de la maqueta (fondo semitransparente y texto celeste atenuado), que tampoco llega a 4.5:1.
- **Orden**: la lista izquierda es alfabética natural (§6.2), por lo que *Resident Evil 0* aparece antes que *Resident Evil 2*. La maqueta muestra un orden cronológico. La grilla se ordena por "jugado recientemente", lo que reproduce las 6 portadas de la maqueta en el mismo orden.
- **Resident Evil (1996)** se dejó en **GOG** (en la maqueta figura con el ícono de Steam) porque ese juego no está en Steam, y así se prueba la insignia de GOG. Solo aparece si GOG está vinculado.
- La navbar es de color lavanda `#AF89C5`, tomado de las maquetas (sigue pendiente de confirmar con diseño).
- Rutas: `/login`, `/biblioteca`, `/juego/:id`, `/cargando/:id?plataforma=…&ligero=0|1`, `/foros`, `/configuraciones`, `/perfil`, `/dev/componentes`.

### Diferencias con las maquetas sin resolver
1. **Portadas y hero**: son placeholders generados con la paleta. Las portadas reales llegan en la fase 2 (CDN de Steam).
2. **Tamaños de texto**: la descripción de la ficha usa 16 px (rol Cuerpo de la guía) y el texto de JUGAR 12 px (rol Etiqueta). En la maqueta 02 la descripción se ve más pequeña, por eso aquí ocupa 3 líneas antes del "…".
3. **Proporciones**: las maquetas son lienzos sin tamaño fijo, así que las medidas se escalaron a una ventana de 1280×800. La navbar mide 96 px y las portadas 176 px de ancho, con gaps parecidos pero no idénticos.
4. **Logo**: en la maqueta las líneas de velocidad de Faster One tienen un degradado más marcado hacia el morado oscuro. Aquí el degradado `background-clip: text` se aplica igual a letras y líneas.
5. **Íconos de plataforma**: se usan los trazados de Simple Icons sobre un círculo oscuro, en vez de los logos a color de la maqueta.
6. **Ficha**: los accesos *Información / Comunidad / Mods* del prototipo en papel (§6.3) aún no están, porque no aparecen en la maqueta 02. Comunidad se integra en la fase 5.
7. **Filtros** por plataforma, instalados y recientes del panel izquierdo (§6.2): pendientes para la fase 3, como indica su prompt. Por ahora solo hay búsqueda (lupa).
8. **Pantalla de carga**: al terminar muestra "juego iniciado" y un enlace "Volver a la biblioteca", porque la minimización a la bandeja llega en la fase 4. Si se elige *Omitir*, se ocultan la tarjeta verde y "Modo ligero activo".
9. **Modo claro**: los tokens existen, pero aún no hay un interruptor en Configuraciones (fase 6).
