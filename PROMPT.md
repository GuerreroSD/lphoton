# Prompt para iniciar el desarrollo de LPhoton

> Copia el bloque de abajo y pégalo en Claude Code (o en tu asistente de código) **con la terminal abierta en la carpeta del proyecto**, donde ya deben estar `LPHOTON.md` y la carpeta `docs/`.
> El prompt cubre las **fases 0 y 1** (base + interfaz con datos simulados). Para avanzar, usa los prompts cortos del final.

---

```
Vas a construir LPhoton, un launcher de escritorio para Windows que unifica las bibliotecas de Steam, Epic Games y GOG, con foco en el bajo consumo de recursos y sin publicidad.

ANTES DE ESCRIBIR CÓDIGO:
1. Lee completo LPHOTON.md. Es la especificación y manda sobre cualquier suposición tuya.
2. Mira TODAS las imágenes de docs/maquetas/ (00 a 04). Son la referencia visual exacta.
3. Revisa docs/guia-de-estilos.pdf para confirmar colores, tipografías y roles de texto.
4. Si algo de la especificación es contradictorio o ambiguo, pregúntame antes de seguir.

STACK (no lo cambies sin preguntarme): Tauri 2 + React 18 + TypeScript + Vite. Estado con Zustand. Las fuentes Faster One, Chakra Petch y Montserrat van incluidas como archivos locales (woff2/ttf) en src/assets/fonts, no cargadas desde Google Fonts.

TAREA (FASES 0 y 1 de LPHOTON.md):

Fase 0 – Base
- Crea el proyecto Tauri 2 + React + TS en esta carpeta, con la estructura de la sección 4.
- Crea src/styles/tokens.css con TODOS los tokens de la sección 5 (colores, fuentes, tamaños por rol, radios y sombras) y úsalos en todo; ningún hex suelto en los componentes.
- Construye los componentes base con sus 3 estados (normal, hover, deshabilitado/seleccionado), copiando la maqueta 00-componentes-botones.png: NavButton, PlayButton, SkipButton (Omitir), LightModeButton (Activar modo ligero), SearchIcon, PlatformBadge (Steam/Epic/GOG), Logo (Faster One con degradado celeste→rosado y caja oscura).
- Crea una ruta /dev/componentes que muestre todos los componentes en sus estados, para compararlos con la maqueta 00.

Fase 1 – Interfaz con datos simulados
- Crea src/mock/mock-games.json con los juegos de Resident Evil que aparecen en la maqueta 01, incluyendo uno que esté en Steam y Epic a la vez (Resident Evil Requiem). Para las portadas, usa imágenes de placeholder generadas localmente (sin descargar arte con copyright).
- Implementa estas pantallas, cada una igual a su maqueta:
  • NavBar común (sección 6.0)
  • Login / vinculación (sección 6.1, sin maqueta: úsa el mismo estilo)
  • Biblioteca unificada → 01-biblioteca.png
  • Ficha del juego → 02-ficha-juego.png (las métricas CPU/RAM pueden ser simuladas por ahora)
  • Diálogo "¿Optimizar RAM?" con fondo desenfocado → 03-dialogo-optimizacion.png
  • Pantalla de carga "inicializando juego" con progreso simulado → 04-pantalla-carga.png
- Flujo navegable: Biblioteca → clic en portada → Ficha → JUGAR → Diálogo → (Omitir o Activar modo ligero) → Pantalla de carga.
- Foros, Configuraciones y Perfil quedan como pantallas con estructura básica y mensaje "en construcción".

REGLAS
- Nada de tiendas, banners, noticias ni pop-ups no pedidos.
- Animaciones cortas (≤150 ms), solo con transform, opacity y box-shadow.
- Textos de la interfaz en español; código en inglés.
- Contraste mínimo de 4.5:1 en todo texto.
- No implementes todavía la lógica real de Steam/Epic/GOG ni la manipulación de procesos (eso es de las fases 2 a 4), pero deja preparados los wrappers en src/lib/ con funciones que devuelvan los datos simulados, para cambiarlos después sin tocar la UI.

AL TERMINAR
- Verifica que `npm run tauri dev` levanta sin errores y que el linter/tsc pasan.
- Compara cada pantalla con su maqueta y corrige las diferencias que veas.
- Crea CHANGELOG.md con lo que hiciste y una lista de las diferencias con las maquetas que no pudiste resolver.
- Dime qué comando corro para verla y qué te falta de mi parte.
```

---

## Prompts para las fases siguientes

**Fase 2 – Steam**
```
Lee LPHOTON.md (secciones 7.1, 7.2 y 8). Implementa la fase 2: detección local de juegos de Steam (registro + libraryfolders.vdf + appmanifest_*.acf), Steam Web API GetOwnedGames (pídeme la API key y el SteamID; guárdalos con keyring), portadas del CDN de Steam en caché en disco, caché SQLite y lanzamiento con steam -silent + steam://rungameid. Reemplaza los datos simulados de src/lib/ por los reales, sin cambiar la UI. Mide el arranque (RNF7) y regístralo.
```

**Fase 3 – Epic, GOG y fusión**
```
Lee LPHOTON.md (7.1 y 8). Implementa la fase 3: lector de manifiestos de Epic, lector de la base de GOG Galaxy y de goggame-*.info, y merge.rs para unir los duplicados entre tiendas (un juego, varios íconos de plataforma). Agrega los filtros por plataforma en el panel izquierdo de la Biblioteca.
```

**Fase 4 – Ejecución intervenida y modo ligero**
```
Lee LPHOTON.md (7.2, 7.3 y 7.4). Implementa la fase 4: launcher.rs, que emite eventos de progreso reales a la pantalla de carga; lightmode.rs con SetPriorityClass(IDLE) + EmptyWorkingSet sobre la lista configurable de webhelpers, restaurando todo al cerrar el juego; nunca suspendas el proceso principal del cliente. Conecta el diálogo "¿Optimizar RAM?" a una detección real del consumo. Al iniciar el juego, minimiza a la bandeja y destruye el WebView. Mide la RAM de LPhoton mientras se juega (meta: < 100 MB).
```

**Fase 5 – Comunidad**
```
Lee LPHOTON.md (6.6). Implementa la pestaña Foros: para cada juego de la biblioteca, consulta la API Cargo de PCGamingWiki (por AppID de Steam o por título), muestra los fixes y mods ordenados y guárdalos en caché. Usa el estilo de la guía, incluido el mensaje de error con enlace a la solución.
```

**Fase 6 – Pulido**
```
Lee LPHOTON.md (6.7, 7.4, 7.5 y 8). Implementa la fase 6: métricas CPU/RAM reales con sysinfo en la ficha del juego, Configuraciones (plataformas, modo ligero preguntar/siempre/nunca, modo claro/oscuro, iniciar con Windows desactivado por defecto) y Perfil. Verifica y documenta en CHANGELOG.md las mediciones de RNF6 y RNF7.
```
