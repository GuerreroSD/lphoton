//! Ejecución intervenida (RF2, LPHOTON.md §7.2).
//!
//! Fase 2: Steam se abre en modo silencioso y el juego se lanza por URI.
//! Fase 4: esperar el proceso del juego, emitir `launch-progress`
//! (client-started → license-validated → game-detected → light-mode-applied)
//! y ocultar ventanas del cliente.

use crate::library::steam;
use crate::models::Platform;
use crate::AppState;

pub fn launch(state: &AppState, platform: Platform, external_id: &str) -> Result<(), String> {
    match platform {
        Platform::Steam => {
            let root = state.steam_root.as_ref().ok_or("No encontramos Steam en este equipo.")?;
            let appid: u32 = external_id.parse().map_err(|_| "Identificador de juego de Steam inválido.")?;
            steam::launch(root, appid).map_err(|e| format!("No pudimos abrir Steam ({e})."))
        }
        Platform::Epic | Platform::Gog => Err("Esta plataforma llegará en la fase 3.".into()),
    }
}
