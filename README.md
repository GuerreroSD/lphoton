# LPhoton

**Launcher de escritorio para Windows que une tus juegos de Steam, Epic Games y GOG en una sola biblioteca.** No tiene anuncios, consume pocos recursos e inicia tus juegos en la menor cantidad de clics.

![Biblioteca de LPhoton](docs/capturas-0.9/biblioteca.png)

> Proyecto del **Electivo I: Taller de UI y UX (UCM)**. Diseño de Luis Barrios Urbina y Alan Troncoso Jara.
> Las capturas usan el modo demo, con portadas de muestra generadas localmente.

## Descargar

**[Descargar LPhoton 0.9.0 para Windows](https://github.com/GuerreroSD/lphoton/releases/download/v0.9.0/LPhoton_0.9.0_x64-setup.exe)** · instalador de 2 MB para Windows 10 u 11 de 64 bits.

1. Abre el archivo descargado. El instalador no está firmado, así que Windows puede mostrar el aviso "Windows protegió su PC": elige **Más información** y luego **Ejecutar de todas formas**.
2. Sigue el instalador. Se instala solo para tu usuario y no pide permisos de administrador.
3. Abre LPhoton desde el menú Inicio y vincula las plataformas que tengas instaladas (Steam, Epic Games o GOG Galaxy).

Las demás versiones están en [Releases](https://github.com/GuerreroSD/lphoton/releases).

---

## Por qué LPhoton

Si tienes poco tiempo para jugar, no quieres perderlo cerrando publicidad, esperando launchers pesados o buscando en foros cómo arreglar un error. LPhoton se basa en dos principios:

- **Eficiencia:** el bajo consumo de recursos va antes que los adornos visuales.
- **Respeto por tu tiempo:** sin tienda, banners ni ventanas emergentes, con navegación directa.

## Funciones

| | |
|---|---|
| **Biblioteca unificada** | Junta Steam, Epic Games y GOG. Si un juego está en dos tiendas, aparece una sola vez con ambos íconos. Tiene filtros por plataforma, instalados y recientes, y una búsqueda rápida (Ctrl+K). Al pasar el cursor, cada portada muestra el tiempo jugado, sus tiendas y un botón **JUGAR** que lanza el juego desde ahí. Los juegos sin instalar se distinguen de un vistazo. |
| **Ambiente** | El arte del juego activo tiñe el fondo de toda la app, detrás de paneles de vidrio oscuro. La portada activa lleva un borde de neón con los colores del logo. |
| **Inicio silencioso** | Abre el cliente de la tienda en segundo plano, sin ventanas, y lanza el juego. La pantalla de carga avanza con eventos reales: cliente iniciado → licencia validada → juego detectado → modo ligero. |
| **Modo ligero** | Mientras juegas, baja la prioridad y libera la RAM de los procesos auxiliares (`steamwebhelper.exe` y similares). Al cerrar el juego, todo vuelve a la normalidad. Nunca toca el proceso principal del cliente, para no romper el DRM ni el guardado en la nube. |
| **Instalar juegos** | Para los juegos que tienes pero no están instalados, el botón **INSTALAR** abre la descarga en su tienda. En Steam, la ficha muestra el progreso real de la descarga. |
| **Comunidad** | Por cada juego tienes un enlace directo a PCGamingWiki y tus propias soluciones y mods, ordenados por votos. |
| **Bandeja del sistema** | Al jugar, LPhoton pasa a la bandeja y cierra su ventana para liberar memoria. Se vuelve a abrir con un clic en el ícono. |
| **Configuraciones** | Modo ligero (preguntar, siempre o nunca) y la lista de procesos que se aligeran, tema claro u oscuro, iniciar con Windows (desactivado por defecto) y rutas de instalación. |
| **Perfil** | Total de juegos y horas jugadas sumadas de todas las tiendas, desglose por plataforma y tus juegos más jugados. |

## Capturas

| Ficha del juego | ¿Optimizar RAM? |
|---|---|
| ![Ficha](docs/capturas-0.9/ficha.png) | ![Diálogo](docs/capturas-0.9/dialogo.png) |
| **Iniciando el juego** | **Instalar con progreso** |
| ![Pantalla de carga](docs/capturas-0.9/carga.png) | ![Instalar](docs/capturas-0.9/instalar.png) |
| **Foros** | **Configuraciones** |
| ![Foros](docs/capturas-0.9/foros.png) | ![Configuraciones](docs/capturas-0.9/configuraciones.png) |
| **Perfil** | **Modo claro** |
| ![Perfil](docs/capturas-0.9/perfil.png) | ![Modo claro](docs/capturas-0.9/biblioteca-claro.png) |

<details>
<summary><b>Diseño anterior (hasta la versión 0.8.0)</b></summary>

Así se veía LPhoton antes del rediseño de la versión 0.9.0, siguiendo las maquetas originales.

| Biblioteca | Ficha del juego |
|---|---|
| ![Biblioteca, diseño anterior](docs/capturas/biblioteca.png) | ![Ficha, diseño anterior](docs/capturas/ficha.png) |
| **¿Optimizar RAM?** | **Iniciando el juego** |
| ![Diálogo, diseño anterior](docs/capturas/dialogo.png) | ![Pantalla de carga, diseño anterior](docs/capturas/carga.png) |
| **Instalar con progreso** | **Foros** |
| ![Instalar, diseño anterior](docs/capturas/instalar.png) | ![Foros, diseño anterior](docs/capturas/foros.png) |
| **Configuraciones** | **Perfil** |
| ![Configuraciones, diseño anterior](docs/capturas/configuraciones.png) | ![Perfil, diseño anterior](docs/capturas/perfil.png) |
| **Modo claro** | **Login** |
| ![Modo claro, diseño anterior](docs/capturas/biblioteca-claro.png) | ![Login, diseño anterior](docs/capturas/login.png) |

</details>

## Rendimiento

Mediciones reales con la app instalada (detalle en [`docs/rendimiento.md`](docs/rendimiento.md)). Se tomaron con la versión 0.8.0, antes del rediseño; aún no se repiten con la 0.9.0.

| Requisito | Meta | Medido |
|---|---|---|
| **RNF7**: arranque hasta ver la biblioteca | < 4 s | **0,6 – 1,8 s** (hasta 159 juegos) |
| **RNF6**: RAM de LPhoton mientras juegas | < 100 MB | **35 – 45 MB** |
| Modo ligero (God of War Ragnarök) | — | **762 MB** liberados de Steam |

## Instalación

Sigue los pasos de [Descargar](#descargar). Si prefieres compilarlo tú, mira [Compilar el instalador](#compilar-el-instalador).

**Requisitos:** Windows 10 u 11 (x64) con WebView2, que ya viene incluido en Windows 11. Para que una plataforma aparezca, su cliente (Steam, Epic Games Launcher o GOG Galaxy) debe estar instalado en el equipo.

### Steam: ver también los juegos no instalados

Sin configurar nada, LPhoton muestra los juegos de Steam **instalados** (los lee de los archivos locales). Para ver **toda** tu biblioteca, con horas jugadas, y poder instalar desde LPhoton:

1. Consigue una API key en <https://steamcommunity.com/dev/apikey>. Steam exige tener activo el Autenticador Móvil de Steam Guard.
2. Pégala en **Configuraciones → Steam**.

La key se guarda en el **Administrador de credenciales de Windows**, nunca en texto plano.

> **Epic Games** no tiene una API pública, así que solo se muestran los juegos instalados. **GOG** lee la base de datos de GOG Galaxy, que incluye también los no instalados.

## Desarrollo

### Requisitos

- [Node.js](https://nodejs.org/) 20 o superior
- [Rust](https://rustup.rs/) estable, con el toolchain MSVC
- Los [requisitos de Tauri 2 para Windows](https://v2.tauri.app/start/prerequisites/): Microsoft C++ Build Tools y WebView2

### Comandos

```bash
npm install            # dependencias del frontend
npm run tauri dev      # app de escritorio con recarga en caliente
npm run dev            # solo la interfaz en el navegador (modo demo con datos simulados)
```

| Comando | Qué hace |
|---|---|
| `npm run typecheck` | Revisa los tipos de TypeScript |
| `npm run lint` | Ejecuta ESLint |
| `cd src-tauri && cargo test` | Corre las pruebas unitarias de Rust |

En el navegador (`npm run dev`), la app usa el **modo demo**: datos simulados de `src/mock/`, sin acceso a Steam, Epic ni GOG. Sirve para trabajar la interfaz sin compilar Rust.

### Compilar el instalador

```bash
npm run tauri build
```

El instalador NSIS queda en `src-tauri/target/release/bundle/nsis/LPhoton_<versión>_x64-setup.exe`.

### Stack

- **[Tauri 2](https://tauri.app/)**: backend en Rust y WebView2 del sistema. Con Electron no se cumpliría el RNF6, porque solo en reposo usa más de 150 MB.
- **React 18 + TypeScript + Vite** en la interfaz, con **Zustand** para el estado y **CSS Modules** con tokens de diseño (`src/styles/tokens.css`).
- **Crates de Rust:**
  - `rusqlite`: caché local
  - `sysinfo` y `windows`: procesos, prioridad y memoria
  - `keyring`: credenciales
  - `winreg`: registro de Windows
  - `reqwest`: Steam Web API y GOG

### Estructura

```
src/                      Interfaz (React)
├── components/           Botones, navbar, logo, diálogo, barra de progreso…
├── screens/              Login, Biblioteca, Ficha, Carga, Foros, Configuraciones, Perfil
├── lib/                  Wrappers de los comandos de Rust (con modo demo)
├── store/                Estado global (Zustand)
├── styles/tokens.css     Colores, tipografías y espaciado (única fuente de estilos)
└── mock/                 Datos simulados para el modo demo

src-tauri/src/            Backend (Rust)
├── library/              Lectores de Steam (VDF/ACF + Web API), Epic (.item) y GOG (Galaxy) + fusión
├── launcher.rs           Inicio silencioso y vigilancia del juego (eventos de progreso)
├── lightmode.rs          Modo ligero: prioridad IDLE + EmptyWorkingSet, y restauración
├── tray.rs               Bandeja del sistema y ciclo de vida de la ventana
├── covers.rs             Protocolo cover:// con caché de portadas en disco
├── community.rs          Soluciones y mods con votos
├── system.rs             Iniciar con Windows y rutas de instalación
├── db.rs                 Caché SQLite
└── platform/windows.rs   Llamadas a la API de Windows
```

## Documentación

- [`LPHOTON.md`](LPHOTON.md): especificación completa (requisitos, sistema de diseño, pantallas, backend y plan por fases)
- [`CHANGELOG.md`](CHANGELOG.md): cambios de cada versión
- [`docs/rendimiento.md`](docs/rendimiento.md): mediciones de RNF6 y RNF7
- [`docs/maquetas/`](docs/maquetas): maquetas originales (el diseño hasta la versión 0.8.0)
- [`docs/guia-de-estilos.pdf`](docs/guia-de-estilos.pdf): guía de estilos

## Privacidad

LPhoton no tiene cuentas propias, servidores ni telemetría. La biblioteca, las portadas, tus soluciones y la configuración se guardan solo en tu equipo. Las únicas conexiones salen a las APIs públicas de Steam y GOG, para la biblioteca, las descripciones y las portadas.
