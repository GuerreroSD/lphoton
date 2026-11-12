//! Comandos expuestos al frontend (`invoke`). Ver `src/lib/*.ts`.

use serde::Serialize;
use tauri::{AppHandle, State};

use crate::library::{self, gog, steam, PlatformsStatus, SyncResult};
use crate::models::{Game, GameDetails, Platform};
use crate::community::{self, CommunityFix, NewFix};
use crate::launcher::LaunchRequest;
use crate::lightmode::{self, ClientLoad};
use crate::metrics::{self, AppMetrics};
use crate::system::{self, InstallPath};
use crate::{credentials, launcher, processes, AppState};

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

/// Descripción, género, desarrollador y año (tienda de Steam o API de GOG), con caché.
/// Epic no tiene API pública: devuelve detalles vacíos.
#[tauri::command]
pub async fn get_game_details(
    state: State<'_, AppState>,
    platform: Platform,
    external_id: String,
) -> Result<GameDetails, String> {
    let state = state.inner().clone();
    let prefix = match platform {
        Platform::Steam => "steam",
        Platform::Epic => "epic",
        Platform::Gog => "gog",
    };
    let id = format!("{prefix}-{external_id}");
    let lookup_state = state.clone();
    let lookup_id = id.clone();
    if let Some(cached) = blocking(move || lookup_state.db.get_details(&lookup_id)).await?.map_err(|e| e.to_string())? {
        return Ok(cached);
    }
    let details = match platform {
        Platform::Steam => {
            let appid: u32 = external_id.parse().map_err(|_| "Identificador de Steam inválido.")?;
            steam::app_details(&state.http, appid).await
        }
        Platform::Gog => gog::details(&state.http, &external_id).await,
        Platform::Epic => return Ok(GameDetails::default()),
    }
    .map_err(|e| format!("No pudimos cargar la información del juego ({e})."))?;
    let save_state = state.clone();
    let to_save = details.clone();
    blocking(move || save_state.db.save_details(&id, &to_save)).await?.map_err(|e| e.to_string())?;
    Ok(details)
}

/// Qué clientes (Steam, Epic, GOG) están instalados en este equipo.
#[tauri::command]
pub async fn platforms_status(state: State<'_, AppState>) -> Result<PlatformsStatus, String> {
    let state = state.inner().clone();
    blocking(move || library::platforms_status(&state)).await
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

/// Lanza el juego y vigila su ciclo de vida. El progreso llega por los eventos
/// `launch-progress`, `launch-done` y `launch-error`.
#[tauri::command]
pub async fn launch_game(app: AppHandle, state: State<'_, AppState>, request: LaunchRequest) -> Result<(), String> {
    let state = state.inner().clone();
    blocking(move || launcher::start(&app, &state, request)).await?
}

/// Consumo actual del cliente nativo (para decidir si mostrar "¿Optimizar RAM?").
#[tauri::command]
pub async fn check_client_load(platform: Platform) -> Result<ClientLoad, String> {
    blocking(move || lightmode::client_load(&processes::fresh_snapshot(), platform)).await
}

/// CPU y RAM de LPhoton (proceso + WebView2).
#[tauri::command]
pub async fn get_app_metrics(state: State<'_, AppState>) -> Result<AppMetrics, String> {
    let state = state.inner().clone();
    blocking(move || metrics::app_metrics(&state)).await
}

#[tauri::command]
pub async fn get_lightmode_targets(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let state = state.inner().clone();
    blocking(move || state.db.lightmode_targets()).await
}

/// Guarda la lista de procesos del modo ligero. Se ignoran los procesos
/// principales de los clientes (nunca se modifican).
#[tauri::command]
pub async fn set_lightmode_targets(state: State<'_, AppState>, targets: Vec<String>) -> Result<Vec<String>, String> {
    let clean: Vec<String> = targets
        .into_iter()
        .map(|t| t.trim().to_string())
        .filter(|t| t.to_lowercase().ends_with(".exe") && t.len() <= 64 && !lightmode::is_protected(t))
        .collect();
    let state = state.inner().clone();
    let json = serde_json::to_string(&clean).map_err(|e| e.to_string())?;
    blocking(move || state.db.set_meta("lightmode_targets", &json)).await?.map_err(|e| e.to_string())?;
    Ok(clean)
}

// ── Comunidad (RF4) ─────────────────────────────────────────────────────

#[tauri::command]
pub async fn list_fixes(state: State<'_, AppState>, game_id: String) -> Result<Vec<CommunityFix>, String> {
    let state = state.inner().clone();
    blocking(move || state.db.list_fixes(&game_id)).await?.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fix_counts(state: State<'_, AppState>) -> Result<std::collections::HashMap<String, i64>, String> {
    let state = state.inner().clone();
    let counts = blocking(move || state.db.fix_counts()).await?.map_err(|e| e.to_string())?;
    Ok(counts.into_iter().collect())
}

#[tauri::command]
pub async fn add_fix(state: State<'_, AppState>, fix: NewFix) -> Result<i64, String> {
    let fix = community::validate(fix)?;
    let state = state.inner().clone();
    blocking(move || state.db.add_fix(&fix)).await?.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn vote_fix(state: State<'_, AppState>, id: i64, delta: i64) -> Result<(), String> {
    let state = state.inner().clone();
    blocking(move || state.db.vote_fix(id, delta)).await?.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_fix(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let state = state.inner().clone();
    blocking(move || state.db.delete_fix(id)).await?.map_err(|e| e.to_string())
}

// ── Instalación de juegos no instalados ─────────────────────────────────

/// Abre la instalación del juego en el cliente de su tienda.
#[tauri::command]
pub async fn install_game(state: State<'_, AppState>, platform: Platform, external_id: String) -> Result<(), String> {
    let state = state.inner().clone();
    blocking(move || {
        let result = match platform {
            Platform::Steam => {
                let root = state.steam_root.as_ref().ok_or("No encontramos Steam en este equipo.")?;
                let appid: u32 = external_id.parse().map_err(|_| "Identificador de juego de Steam inválido.")?;
                steam::install(root, appid).map_err(|e| format!("No pudimos abrir Steam ({e})."))
            }
            Platform::Epic => {
                let uri = crate::library::epic::install_uri(&external_id).ok_or("Identificador de juego de Epic inválido.")?;
                tauri_plugin_opener::open_url(uri, None::<&str>).map_err(|e| format!("No pudimos abrir Epic Games ({e})."))
            }
            Platform::Gog => {
                if external_id.is_empty() || !external_id.chars().all(|c| c.is_ascii_digit()) {
                    return Err("Identificador de juego de GOG inválido.".to_string());
                }
                tauri_plugin_opener::open_url(format!("goggalaxy://openGameView/{external_id}"), None::<&str>)
                    .map_err(|_| "No pudimos abrir GOG Galaxy. ¿Está instalado?".to_string())
            }
        };
        crate::log_line(&state, &format!("install_requested platform={platform:?} id={external_id} ok={}", result.is_ok()));
        result
    })
    .await?
}

/// Progreso de descarga de un juego de Steam (lee su appmanifest).
#[tauri::command]
pub async fn install_status(state: State<'_, AppState>, appid: u32) -> Result<steam::InstallStatus, String> {
    let state = state.inner().clone();
    blocking(move || match &state.steam_root {
        Some(root) => steam::install_status(root, appid),
        None => steam::InstallStatus { state: "none", ..Default::default() },
    })
    .await
}

// ── Configuraciones (§6.7) ──────────────────────────────────────────────

#[tauri::command]
pub async fn get_autostart() -> Result<bool, String> {
    blocking(system::autostart_enabled).await
}

#[tauri::command]
pub async fn set_autostart(enabled: bool) -> Result<bool, String> {
    blocking(move || system::set_autostart(enabled)).await??;
    Ok(enabled)
}

#[tauri::command]
pub async fn install_paths(state: State<'_, AppState>) -> Result<Vec<InstallPath>, String> {
    let state = state.inner().clone();
    blocking(move || system::install_paths(&state)).await
}

#[tauri::command]
pub async fn open_install_path(state: State<'_, AppState>, path: String) -> Result<(), String> {
    let state = state.inner().clone();
    blocking(move || system::open_install_path(&state, &path)).await?
}

/// El frontend avisa cuando la biblioteca ya está pintada (RNF7).
/// Se registra `startup_ms` (desde que arrancó el proceso) en el log.
#[tauri::command]
pub fn report_startup(state: State<'_, AppState>, games: usize) -> Option<u128> {
    if state.startup_reported.swap(true, std::sync::atomic::Ordering::SeqCst) {
        return None;
    }
    let ms = state.started.elapsed().as_millis();
    crate::log_line(&state, &format!("startup_ms={ms} games={games}"));
    Some(ms)
}

// ── Iniciar sesión con Steam ────────────────────────────────────────────

/// Abre la página oficial de Steam en el navegador y espera a que el usuario
/// inicie sesión. Devuelve la cuenta verificada (SteamID, nombre y avatar).
#[tauri::command]
pub async fn steam_login(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<crate::steam_login::SteamAccount, String> {
    use tauri_plugin_opener::OpenerExt;
    let pending = crate::steam_login::prepare()?;
    app.opener()
        .open_url(pending.login_url.clone(), None::<&str>)
        .map_err(|e| format!("No se pudo abrir el navegador: {e}"))?;
    let return_to = pending.return_to.clone();
    let (mut stream, params) = blocking(move || crate::steam_login::wait_for_callback(&pending)).await??;

    let state = state.inner().clone();
    let verified = crate::steam_login::verify(&state.http, &params, &return_to).await;
    let page = match &verified {
        Ok(_) => crate::steam_login::page(true, ""),
        Err(e) => crate::steam_login::page(false, e),
    };
    blocking(move || crate::steam_login::respond(&mut stream, 200, &page)).await?;
    let steam_id = verified?;
    crate::log_line(&state, "steam_login ok");
    // Volver a LPhoton: la ventana pasa al frente.
    crate::tray::show_main_window(&app);
    Ok(crate::steam_login::profile(&state.http, steam_id).await)
}

#[tauri::command]
pub fn steam_login_cancel() {
    crate::steam_login::cancel();
}
