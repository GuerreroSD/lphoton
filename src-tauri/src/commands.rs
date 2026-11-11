//! Comandos expuestos al frontend (`invoke`).
//!
//! Previstos: `get_library`, `link_platform`, `launch_game`, `check_client_load`,
//! `get_app_metrics` (ver `src/lib/*.ts`).

#[tauri::command]
pub fn app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}
