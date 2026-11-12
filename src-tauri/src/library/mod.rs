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

#[derive(Debug, Clone, Serialize)]
pub struct PlatformsStatus {
    pub steam: bool,
    pub epic: bool,
    pub gog: bool,
}

/// Qué clientes están instalados en este equipo.
pub fn platforms_status(state: &AppState) -> PlatformsStatus {
    PlatformsStatus { steam: state.steam_root.is_some(), epic: epic::manifests_dir().is_some(), gog: gog::detected() }
}

/// Epic y GOG: todo es local (manifiestos, registro y base de Galaxy).
fn other_platforms(state: &AppState) -> Vec<Game> {
    let mut games = Vec::new();
    if let Some(dir) = epic::manifests_dir() {
        games.extend(epic::build_games(&epic::installed_apps(&dir)));
    }
    games.extend(gog::build_games(&gog::local_games(&state.cache_dir.join("gog"))));
    games
}

/// Biblioteca solo con datos locales (sin red). Rápida: sirve para el primer arranque.
pub fn scan_local(state: &AppState) -> Vec<Game> {
    // Steam primero: al fusionar, el juego conserva el id (y la portada) de Steam.
    let mut games = Vec::new();
    if let Some(root) = &state.steam_root {
        let installed = steam::installed_apps(root);
        let playtime = steam::detect_steam_id(root)
            .map(|id| steam::local_playtime(root, id))
            .unwrap_or_default();
        games.extend(steam::build_games(&installed, &playtime, None));
    }
    games.extend(other_platforms(state));
    merge::merge(games)
}

/// Sincronización completa: local + Steam Web API (si hay API key).
pub async fn sync(state: &AppState) -> SyncResult {
    let local_state = state.clone();
    let others = tauri::async_runtime::spawn_blocking(move || other_platforms(&local_state)).await.unwrap_or_default();

    let Some(root) = state.steam_root.clone() else {
        return SyncResult { games: merge::merge(others), warning: None };
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
            Ok(games) => {
                // Diagnóstico de horas: queda en lphoton.log, solo con lo que no cuadra.
                for line in steam::playtime_mismatches(&games, &playtime) {
                    crate::log_line(state, &line);
                }
                owned = Some(games);
            }
            Err(e) => warning = Some(format!("Error al sincronizar con Steam. {e}")),
        }
    }

    let mut games = steam::build_games(&installed, &playtime, owned.as_deref());
    games.extend(others);
    let games = merge::merge(games);
    SyncResult { games, warning }
}
