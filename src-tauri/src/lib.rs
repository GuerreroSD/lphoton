//! Backend de LPhoton (Tauri 2).

mod commands;
mod covers;
mod credentials;
mod db;
mod launcher;
mod library;
mod lightmode;
mod metrics;
mod models;
mod platform;

use std::io::Write;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use tauri::Manager;

/// Estado compartido. Se clona barato (todo va detrás de `Arc`).
#[derive(Clone)]
pub struct AppState {
    inner: Arc<Inner>,
}

pub struct Inner {
    pub db: db::Db,
    pub http: reqwest::Client,
    pub cache_dir: PathBuf,
    pub log_path: PathBuf,
    pub steam_root: Option<PathBuf>,
    pub started: Instant,
    pub sync_lock: tauri::async_runtime::Mutex<()>,
}

impl std::ops::Deref for AppState {
    type Target = Inner;
    fn deref(&self) -> &Inner {
        &self.inner
    }
}

/// Agrega una línea con marca de tiempo a `<app_log_dir>/lphoton.log`.
pub fn log_line(state: &AppState, message: &str) {
    let ts = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let line = format!("{} {message}", models::unix_to_iso(ts));
    println!("{line}");
    if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(&state.log_path) {
        let _ = writeln!(file, "{line}");
    }
}

pub fn run() {
    let started = Instant::now();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .register_asynchronous_uri_scheme_protocol("cover", covers::handle)
        .setup(move |app| {
            let paths = app.path();
            let data_dir = paths.app_data_dir()?;
            let cache_dir = paths.app_cache_dir()?;
            let log_dir = paths.app_log_dir()?;
            for dir in [&data_dir, &cache_dir, &log_dir] {
                std::fs::create_dir_all(dir)?;
            }

            let state = AppState {
                inner: Arc::new(Inner {
                    db: db::Db::open(&data_dir.join("lphoton.db"))?,
                    http: library::steam::http_client(),
                    cache_dir,
                    log_path: log_dir.join("lphoton.log"),
                    steam_root: library::steam::steam_root(),
                    started,
                    sync_lock: tauri::async_runtime::Mutex::new(()),
                }),
            };
            log_line(&state, &format!("setup_ms={}", started.elapsed().as_millis()));
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_version,
            commands::get_cached_library,
            commands::sync_library,
            commands::get_game_details,
            commands::steam_status,
            commands::set_steam_api_key,
            commands::clear_steam_api_key,
            commands::launch_game,
            commands::report_startup,
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar LPhoton");
}
