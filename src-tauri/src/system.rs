//! Opciones del sistema para Configuraciones (LPHOTON.md §6.7):
//! iniciar con Windows (desactivado por defecto) y rutas de instalación.

use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::library::{epic, gog, steam};
use crate::models::Platform;
use crate::AppState;

/// Argumento con el que Windows abre LPhoton al iniciar sesión: arranca solo en la bandeja.
pub const TRAY_ARG: &str = "--tray";

#[cfg(windows)]
const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
#[cfg(windows)]
const RUN_VALUE: &str = "LPhoton";

pub fn started_in_tray() -> bool {
    std::env::args().any(|a| a == TRAY_ARG)
}

fn run_command() -> std::io::Result<String> {
    let exe = std::env::current_exe()?;
    Ok(format!("\"{}\" {TRAY_ARG}", exe.display()))
}

/// `true` si LPhoton está registrado en `HKCU\…\Run` apuntando a este ejecutable.
#[cfg(windows)]
pub fn autostart_enabled() -> bool {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;
    let Ok(key) = RegKey::predef(HKEY_CURRENT_USER).open_subkey(RUN_KEY) else { return false };
    let Ok(value) = key.get_value::<String, _>(RUN_VALUE) else { return false };
    run_command().map(|cmd| cmd.eq_ignore_ascii_case(&value)).unwrap_or(false)
}

#[cfg(windows)]
pub fn set_autostart(enabled: bool) -> Result<(), String> {
    use winreg::enums::{HKEY_CURRENT_USER, KEY_SET_VALUE};
    use winreg::RegKey;
    let (key, _) = RegKey::predef(HKEY_CURRENT_USER)
        .create_subkey_with_flags(RUN_KEY, KEY_SET_VALUE)
        .map_err(|e| format!("No pudimos cambiar el inicio con Windows: {e}"))?;
    if enabled {
        let cmd = run_command().map_err(|e| e.to_string())?;
        key.set_value(RUN_VALUE, &cmd).map_err(|e| format!("No pudimos activar el inicio con Windows: {e}"))
    } else {
        match key.delete_value(RUN_VALUE) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(format!("No pudimos desactivar el inicio con Windows: {e}")),
        }
    }
}

#[cfg(not(windows))]
pub fn autostart_enabled() -> bool {
    false
}

#[cfg(not(windows))]
pub fn set_autostart(_enabled: bool) -> Result<(), String> {
    Err("Solo disponible en Windows.".into())
}

// ── Rutas de instalación ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InstallPath {
    pub platform: Platform,
    pub path: String,
    /// Juegos instalados en esa carpeta.
    pub games: usize,
}

/// Agrupa carpetas de juegos por su carpeta contenedora (p. ej. `D:\Epic Games`).
fn group_by_parent(dirs: impl IntoIterator<Item = PathBuf>) -> Vec<(PathBuf, usize)> {
    let mut out: Vec<(PathBuf, usize)> = Vec::new();
    for dir in dirs {
        let parent = dir.parent().map(Path::to_path_buf).unwrap_or(dir);
        let key = parent.to_string_lossy().to_lowercase();
        match out.iter_mut().find(|(p, _)| p.to_string_lossy().to_lowercase() == key) {
            Some((_, n)) => *n += 1,
            None => out.push((parent, 1)),
        }
    }
    out
}

pub fn install_paths(state: &AppState) -> Vec<InstallPath> {
    let mut out = Vec::new();
    if let Some(root) = &state.steam_root {
        for folder in steam::library_folders(root) {
            let steamapps = folder.join("steamapps");
            let games = std::fs::read_dir(&steamapps)
                .map(|entries| {
                    entries
                        .flatten()
                        .filter(|e| {
                            let name = e.file_name().to_string_lossy().to_lowercase();
                            name.starts_with("appmanifest_") && name.ends_with(".acf")
                        })
                        .count()
                })
                .unwrap_or(0);
            let common = steamapps.join("common");
            out.push(InstallPath { platform: Platform::Steam, path: common.display().to_string(), games });
        }
    }
    if let Some(dir) = epic::manifests_dir() {
        let dirs = epic::installed_apps(&dir).into_iter().filter(|a| a.installed).map(|a| a.install_location);
        for (path, games) in group_by_parent(dirs) {
            out.push(InstallPath { platform: Platform::Epic, path: path.display().to_string(), games });
        }
    }
    let gog_dirs = gog::local_games(&state.cache_dir.join("gog")).into_iter().filter_map(|g| g.install_path);
    for (path, games) in group_by_parent(gog_dirs) {
        out.push(InstallPath { platform: Platform::Gog, path: path.display().to_string(), games });
    }
    out
}

/// Abre una carpeta en el Explorador, solo si es una de las rutas detectadas.
pub fn open_install_path(state: &AppState, path: &str) -> Result<(), String> {
    let known = install_paths(state).into_iter().any(|p| p.path == path);
    if !known || !Path::new(path).is_dir() {
        return Err("Esa carpeta ya no existe.".into());
    }
    std::process::Command::new("explorer.exe").arg(path).spawn().map(|_| ()).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn groups_game_dirs_by_parent_case_insensitive() {
        let groups = group_by_parent([
            PathBuf::from(r"D:\Epic Games\Fortnite"),
            PathBuf::from(r"d:\epic games\RocketLeague"),
            PathBuf::from(r"C:\Games\Hades"),
        ]);
        assert_eq!(groups.len(), 2);
        assert_eq!(groups[0], (PathBuf::from(r"D:\Epic Games"), 2));
        assert_eq!(groups[1], (PathBuf::from(r"C:\Games"), 1));
    }

    #[test]
    fn run_command_uses_tray_arg() {
        let cmd = run_command().unwrap();
        assert!(cmd.starts_with('"') && cmd.ends_with(TRAY_ARG));
    }
}
