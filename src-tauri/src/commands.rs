//! Comandos expuestos al frontend (`invoke`). Ver `src/lib/*.ts`.

use serde::Serialize;
use tauri::State;

use crate::library::{self, steam, SyncResult};
use crate::models::{Game, GameDetails, Platform};
use crate::{credentials, launcher, AppState};

fn blocking<T: Send + 'static>(f: impl FnOnce() -> T + Send + 'static) -> impl std::future::Future<Output = Result<T, String>> {
    async move { tauri::async_runtime::spawn_blocking(f).await.map_err(|e| e.to_string()) }
}

#[tauri::command]
pub fn app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

/// Biblioteca en caché (instantánea). Si la caché está vacía, hace un escaneo
/// local sin red y lo guarda.
#[tauri::command]
pub async fn get_cached_library(state: State<'_, AppState>) -> Result<Vec<Game>, String> {
    let state = state.inner().clone();
    blocking(move || {
        let cached = state.db.load_games().map_err(|e| e.to_string())?;
        if !cached.is_empty() {
            return Ok(cached);
        }
        let games = library::scan_local(&state);
        state.db.replace_games(&games).map_err(|e| e.to_string())?;
        Ok(games)
    })
    .await?
}

/// Sincroniza con Steam (local + Web API) y actualiza la caché.
#[tauri::command]
pub async fn sync_library(state: State<'_, AppState>) -> Result<SyncResult, String> {
    let state = state.inner().clone();
    // Evita dos sincronizaciones simultáneas.
    let _guard = state.sync_lock.lock().await;
    let result = library::sync(&state).await;
    // Si Steam no está o falla todo, no se borra la caché existente.
    if !result.games.is_empty() {
        let db_state = state.clone();
        let games = result.games.clone();
        blocking(move || db_state.db.replace_games(&games)).await?.map_err(|e| e.to_string())?;
    }
    Ok(result)
}

/// Descripción, género, desarrollador y año (tienda de Steam), con caché.
#[tauri::command]
pub async fn get_game_details(state: State<'_, AppState>, id: String) -> Result<GameDetails, String> {
    let state = state.inner().clone();
    let lookup_state = state.clone();
    let lookup_id = id.clone();
    if let Some(cached) = blocking(move || lookup_state.db.get_details(&lookup_id)).await?.map_err(|e| e.to_string())? {
        return Ok(cached);
    }
    let appid: u32 = id
        .strip_prefix("steam-")
        .and_then(|a| a.parse().ok())
        .ok_or("Solo hay detalles para juegos de Steam por ahora.")?;
    let details = steam::app_details(&state.http, appid)
        .await
        .map_err(|e| format!("No pudimos cargar la información del juego ({e})."))?;
    let save_state = state.clone();
    let to_save = details.clone();
    blocking(move || save_state.db.save_details(&id, &to_save)).await?.map_err(|e| e.to_string())?;
    Ok(details)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamStatus {
    /// Steam está instalado en este equipo.
    detected: bool,
    steam_id: Option<String>,
    has_api_key: bool,
}

#[tauri::command]
pub async fn steam_status(state: State<'_, AppState>) -> Result<SteamStatus, String> {
    let state = state.inner().clone();
    blocking(move || SteamStatus {
        detected: state.steam_root.is_some(),
        steam_id: state.steam_root.as_deref().and_then(steam::detect_steam_id).map(|id| id.to_string()),
        has_api_key: credentials::steam_api_key().is_some(),
    })
    .await
}

/// Valida la API key contra la Web API y, si funciona, la guarda en el
/// administrador de credenciales. Devuelve cuántos juegos tiene la cuenta.
#[tauri::command]
pub async fn set_steam_api_key(state: State<'_, AppState>, key: String) -> Result<usize, String> {
    let key = key.trim().to_string();
    if !credentials::is_valid_steam_api_key(&key) {
        return Err("La API key debe tener 32 caracteres (letras A-F y números).".into());
    }
    let state = state.inner().clone();
    let root = state.steam_root.clone().ok_or("No encontramos Steam en este equipo.")?;
    let steam_id = blocking(move || steam::detect_steam_id(&root))
        .await?
        .ok_or("No encontramos tu cuenta de Steam. Inicia sesión en Steam al menos una vez.")?;
    let games = steam::owned_games(&state.http, &key, steam_id).await.map_err(|e| e.to_string())?;
    blocking(move || credentials::set_steam_api_key(&key)).await??;
    Ok(games.len())
}

#[tauri::command]
pub async fn clear_steam_api_key() -> Result<(), String> {
    blocking(credentials::clear_steam_api_key).await?
}

#[tauri::command]
pub async fn launch_game(state: State<'_, AppState>, platform: Platform, external_id: String) -> Result<(), String> {
    let state = state.inner().clone();
    blocking(move || launcher::launch(&state, platform, &external_id)).await?
}

/// El frontend avisa cuando la biblioteca ya está pintada (RNF7).
/// Se registra `startup_ms` (desde que arrancó el proceso) en el log.
#[tauri::command]
pub fn report_startup(state: State<'_, AppState>, games: usize) -> u128 {
    let ms = state.started.elapsed().as_millis();
    crate::log_line(&state, &format!("startup_ms={ms} games={games}"));
    ms
}
