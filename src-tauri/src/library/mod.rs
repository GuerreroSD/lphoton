//! Lectores de bibliotecas por plataforma y fusión de duplicados (RF1, §7.1).

pub mod epic;
pub mod gog;
pub mod merge;
pub mod steam;
pub mod vdf;

use serde::Serialize;

use crate::credentials;
use crate::models::Game;
use crate::AppState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub games: Vec<Game>,
    /// Aviso no bloqueante (p. ej. la Web API falló y se usaron solo los instalados).
    pub warning: Option<String>,
}

/// Biblioteca solo con datos locales (sin red). Rápida: sirve para el primer arranque.
pub fn scan_local(state: &AppState) -> Vec<Game> {
    let Some(root) = &state.steam_root else { return Vec::new() };
    let installed = steam::installed_apps(root);
    let playtime = steam::detect_steam_id(root)
        .map(|id| steam::local_playtime(root, id))
        .unwrap_or_default();
    merge::merge(steam::build_games(&installed, &playtime, None))
}

/// Sincronización completa: local + Steam Web API (si hay API key).
pub async fn sync(state: &AppState) -> SyncResult {
    let Some(root) = state.steam_root.clone() else {
        return SyncResult { games: Vec::new(), warning: Some("No encontramos Steam en este equipo.".into()) };
    };

    let local_root = root.clone();
    let (installed, steam_id, playtime) = tauri::async_runtime::spawn_blocking(move || {
        let installed = steam::installed_apps(&local_root);
        let steam_id = steam::detect_steam_id(&local_root);
        let playtime = steam_id.map(|id| steam::local_playtime(&local_root, id)).unwrap_or_default();
        (installed, steam_id, playtime)
    })
    .await
    .unwrap_or_default();

    let mut warning = None;
    let mut owned = None;
    if let (Some(key), Some(id)) = (credentials::steam_api_key(), steam_id) {
        match steam::owned_games(&state.http, &key, id).await {
            Ok(games) => owned = Some(games),
            Err(e) => warning = Some(format!("Error al sincronizar con Steam. {e}")),
        }
    }

    let games = merge::merge(steam::build_games(&installed, &playtime, owned.as_deref()));
    SyncResult { games, warning }
}
