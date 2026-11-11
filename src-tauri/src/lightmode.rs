//! Modo ligero (RF3, LPHOTON.md §7.3). Fase 4.
//!
//! Tras detectar el proceso del juego: `SetPriorityClass(IDLE_PRIORITY_CLASS)` y
//! `EmptyWorkingSet` sobre los webhelpers configurables. Nunca se suspende el
//! proceso principal del cliente. Al cerrar el juego se restaura todo.

/// Procesos objetivo por defecto (lista configurable).
#[allow(dead_code)]
pub const DEFAULT_TARGETS: &[&str] = &[
    "steamwebhelper.exe",
    "EpicWebHelper.exe",
    "GalaxyClient Helper.exe",
];
