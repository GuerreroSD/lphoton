//! Ejecución intervenida (RF2, LPHOTON.md §7.2).
//!
//! Fase 2: Steam se abre en modo silencioso y el juego se lanza por URI.
//! Fase 4: esperar el proceso del juego, emitir `launch-progress`
//! (client-started → license-validated → game-detected → light-mode-applied)
//! y ocultar ventanas del cliente.

use crate::library::{epic, gog, steam};
use crate::models::Platform;
use crate::AppState;

pub fn launch(state: &AppState, platform: Platform, external_id: &str) -> Result<(), String> {
    let result = launch_inner(state, platform, external_id);
    let outcome = match &result {
        Ok(()) => "ok".to_string(),
        Err(e) => format!("error: {e}"),
    };
    crate::log_line(state, &format!("launch platform={platform:?} id={external_id} {outcome}"));
    result
}

fn launch_inner(state: &AppState, platform: Platform, external_id: &str) -> Result<(), String> {
    match platform {
        Platform::Steam => {
            let root = state.steam_root.as_ref().ok_or("No encontramos Steam en este equipo.")?;
            let appid: u32 = external_id.parse().map_err(|_| "Identificador de juego de Steam inválido.")?;
            steam::launch(root, appid).map_err(|e| format!("No pudimos abrir Steam ({e})."))
        }
        // El lanzador de Epic se abre en modo silencioso a través de su protocolo.
        Platform::Epic => {
            let uri = epic::launch_uri(external_id).ok_or("Identificador de juego de Epic inválido.")?;
            tauri_plugin_opener::open_url(uri, None::<&str>).map_err(|e| format!("No pudimos abrir Epic Games ({e})."))
        }
        // Sin DRM: se ejecuta el .exe directamente, sin abrir GOG Galaxy.
        Platform::Gog => gog::launch(external_id),
    }
}
