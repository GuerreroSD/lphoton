# Rendimiento de LPhoton (RNF6 y RNF7)

Mediciones reales en el equipo de desarrollo: Windows 11 Pro, LPhoton instalado con el instalador NSIS (build *release*) y bibliotecas reales de Steam, Epic y GOG. Todos los valores salen del log de la app:

```
%LOCALAPPDATA%\cl.ucm.lphoton\logs\lphoton.log
```

## RNF7 · Arranque inmediato (< 4 s)

**Qué se mide:** el tiempo desde que arranca el proceso hasta que la biblioteca está pintada en pantalla. El frontend llama a `report_startup` cuando termina el primer render con la caché, y Rust escribe `startup_ms=<ms> games=<n>` **una sola vez por proceso**. Reabrir la ventana desde la bandeja no cuenta como arranque.

**Cómo se cumple (§7.5):**
- La biblioteca se pinta primero desde la caché SQLite, sin ninguna llamada de red. La sincronización con Steam, Epic y GOG corre después, en segundo plano.
- Las portadas se cargan con *lazy loading* desde la caché en disco (protocolo `cover://`).
- El ejecutable pesa poco (Tauri 2 + WebView2 del sistema; instalador de unos 2 MB).

| Fecha (UTC) | `startup_ms` | Juegos |
|---|---:|---:|
| 2026-11-11 18:02 | 1071 | 31 |
| 2026-11-11 18:03 | 971 | 31 |
| 2026-11-11 18:08 | 585 | 31 |
| 2026-11-11 18:18 | 680 | 31 |
| 2026-11-11 18:23 | 1290 | 31 |
| 2026-11-11 18:25 | 693 | 32 |
| 2026-11-11 18:38 | 598 | 32 |
| 2026-11-11 18:38 | 1433 | 32 |
| 2026-11-11 18:48 | 1813 | 32 |
| 2026-11-11 22:39 | 778 | 159 |

**Resultado:** entre **0,6 s y 1,8 s**, también con 159 juegos. **Cumple** (< 4 s).

> Dos valores del log quedan fuera de la tabla. Ninguno es un arranque real:
> - `344606` (18:44): la ventana se reabrió desde la bandeja después de jugar. Antes de la versión 0.4.0 se volvía a medir en cada reapertura; desde entonces se mide una sola vez por proceso.
> - `21375` (18:57): la ventana se abrió durante una recompilación de `tauri dev`. No corresponde a la app instalada.

## RNF6 · Bajo consumo mientras se juega (< 100 MB)

**Qué se mide:** la RAM sumada del proceso de LPhoton y todos sus procesos hijos, incluidos los de WebView2 (`processes::tree` con `sysinfo`). Se mide unos segundos después de minimizar a la bandeja con el juego en curso, y queda en el log como `ram_playing_mb=<MB> game="<título>"`.

**Cómo se cumple (§7.4):**
- Cuando aparece el proceso del juego, LPhoton **destruye su ventana**. Así se cierran también los procesos de WebView2, que concentran casi toda la RAM. Solo queda vivo el proceso Rust, que vigila el juego.
- La ventana se vuelve a crear al hacer clic en el ícono de la bandeja.
- La vigilancia del juego es un hilo que revisa los procesos cada pocos segundos, sin animaciones ni timers en la UI.

| Juego | `ram_playing_mb` |
|---|---:|
| Dead by Daylight (Steam) | 42 |
| God of War Ragnarök (Steam) | 45 |
| Fortnite (Epic) | 35 |

**Resultado:** entre **35 MB y 45 MB** mientras se juega. **Cumple** (< 100 MB).

Con la ventana abierta, la etiqueta de la ficha (`CPU · RAM`) muestra en vivo ese mismo total (LPhoton más WebView2).

## Modo ligero (RF3), como referencia

En la misma sesión de *God of War Ragnarök*, el log registró `lightmode_applied adjusted=10 failed=0 freed_mb=762`. Se ajustaron 10 procesos auxiliares de Steam (`steamwebhelper.exe`) a prioridad mínima, se liberaron **762 MB** de su memoria de trabajo y, al cerrar el juego, se restauró su prioridad original.

## Cómo repetir las mediciones

1. Instala LPhoton con `LPhoton_<versión>_x64-setup.exe` y ábrelo. El log tendrá una línea `startup_ms` nueva.
2. Inicia un juego desde la ficha y espera a que LPhoton pase a la bandeja. Unos segundos después aparece `ram_playing_mb`.
3. Si aceptaste el modo ligero, también aparecen `lightmode_applied … freed_mb=` y, al cerrar el juego, la restauración.
