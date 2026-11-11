//! Backend de LPhoton (Tauri 2).

mod commands;
mod community;
mod covers;
mod credentials;
mod db;
mod launcher;
mod library;
mod lightmode;
mod metrics;
mod models;
mod platform;
mod processes;
mod system;
mod tray;

use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64};
use std::sync::{Arc, Mutex};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use tauri::{Manager, RunEvent};

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
    /// Juego en curso (uno a la vez) y lo que el modo ligero modificó.
    pub session: Mutex<Option<Session>>,
    /// Cambia en cada lanzamiento o cierre: el hilo vigilante viejo se detiene.
    pub generation: AtomicU64,
    pub metrics_sys: Mutex<sysinfo::System>,
    /// `startup_ms` se mide una sola vez por proceso (no al reabrir la ventana).
    pub startup_reported: AtomicBool,
}

pub struct Session {
    pub generation: u64,
    pub title: String,
    pub adjusted: Vec<lightmode::Adjusted>,
}

impl AppState {
    pub fn session_active(&self) -> bool {
        self.session.lock().map(|s| s.is_some()).unwrap_or(false)
    }
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
        // Debe ir primero: si LPhoton ya está abierto (o en la bandeja), se
        // muestra esa ventana en vez de abrir una segunda copia.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| tray::show_main_window(app)))
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
                    session: Mutex::new(None),
                    generation: AtomicU64::new(0),
                    metrics_sys: Mutex::new(sysinfo::System::new()),
                    startup_reported: AtomicBool::new(false),
                }),
            };
            tray::ensure(app.handle(), "LPhoton");
            // Restaurar en segundo plano lo que haya quedado de un cierre inesperado.
            let recovery = state.clone();
            std::thread::spawn(move || launcher::recover_pending(&recovery));
            log_line(&state, &format!("setup_ms={}", started.elapsed().as_millis()));
            app.manage(state);
            // Inicio con Windows: arranca solo en la bandeja, sin crear el WebView.
            if system::started_in_tray() {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.destroy();
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_version,
            commands::get_cached_library,
            commands::sync_library,
            commands::get_game_details,
            commands::steam_status,
            commands::platforms_status,
            commands::set_steam_api_key,
            commands::clear_steam_api_key,
            commands::launch_game,
            commands::report_startup,
            commands::check_client_load,
            commands::get_app_metrics,
            commands::get_lightmode_targets,
            commands::set_lightmode_targets,
            commands::list_fixes,
            commands::fix_counts,
            commands::add_fix,
            commands::vote_fix,
            commands::delete_fix,
            commands::get_autostart,
            commands::set_autostart,
            commands::install_paths,
            commands::open_install_path,
        ])
        .build(tauri::generate_context!())
        .expect("error al iniciar LPhoton")
        .run(|app, event| match event {
            // Se cerró la ventana: LPhoton sigue en la bandeja (como Steam).
            // Para salir del todo: clic derecho en el ícono → "Salir".
            RunEvent::ExitRequested { code: None, api, .. } => {
                api.prevent_exit();
                let tooltip = if app.state::<AppState>().session_active() { "LPhoton · juego en curso" } else { "LPhoton" };
                tray::ensure(app, tooltip);
            }
            // Cierre definitivo: nunca dejar procesos con la prioridad cambiada.
            RunEvent::Exit => launcher::end_session(&app.state::<AppState>(), "cierre de LPhoton"),
            _ => {}
        });
}
