//! Ejecución intervenida (RF2, LPHOTON.md §7.2) con progreso real (pantalla 6.5).
//!
//! 1. Abrir el cliente en modo silencioso y lanzar el juego (URI / .exe).
//! 2. Vigilar los procesos y emitir `launch-progress`:
//!    client-started → license-validated (aparece un proceso en la carpeta del
//!    juego) → game-detected (sigue vivo unos segundos) → light-mode-applied.
//! 3. Modo ligero (si se pidió) y minimizar a la bandeja destruyendo el WebView.
//! 4. Al cerrarse el juego, restaurar la prioridad de lo modificado.

use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::library::{epic, gog, steam};
use crate::models::Platform;
use crate::processes::{self, Proc};
use crate::{lightmode, tray, AppState, Session};

const POLL: Duration = Duration::from_millis(700);
const CLIENT_TIMEOUT: Duration = Duration::from_secs(60);
/// Margen amplio: Steam puede actualizar el juego antes de abrirlo.
const GAME_TIMEOUT: Duration = Duration::from_secs(300);
/// El proceso debe seguir vivo este tiempo para darlo por "detectado".
const STABLE_FOR: Duration = Duration::from_secs(3);
/// Tiempo sin procesos del juego para darlo por cerrado.
const CLOSED_AFTER: Duration = Duration::from_secs(5);
const REAPPLY_EVERY: Duration = Duration::from_secs(30);
const MINIMIZE_DELAY: Duration = Duration::from_millis(1500);
const RAM_SAMPLE_AFTER: Duration = Duration::from_secs(15);

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchRequest {
    pub game_id: String,
    pub title: String,
    pub platform: Platform,
    pub external_id: String,
    pub light_mode: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressEvent<'a> {
    game_id: &'a str,
    step: &'static str,
    progress: f32,
    /// Texto opcional (p. ej. "Se liberaron 450 MB de RAM").
    detail: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DoneEvent<'a> {
    game_id: &'a str,
    /// "playing" (el juego está abierto) o "handoff" (el cliente sigue, p. ej. instalación).
    outcome: &'static str,
    message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ErrorEvent<'a> {
    game_id: &'a str,
    message: String,
}

// ── Lanzamiento directo ─────────────────────────────────────────────────

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

fn install_dir(state: &AppState, platform: Platform, external_id: &str) -> Option<PathBuf> {
    match platform {
        Platform::Steam => steam::install_dir(state.steam_root.as_deref()?, external_id.parse().ok()?),
        Platform::Epic => epic::install_dir(external_id),
        Platform::Gog => gog::install_dir(external_id),
    }
}

/// Proceso principal del cliente que debe estar abierto para lanzar el juego.
fn client_exe(platform: Platform) -> Option<&'static str> {
    match platform {
        Platform::Steam => Some("steam.exe"),
        Platform::Epic => Some("EpicGamesLauncher.exe"),
        Platform::Gog => None,
    }
}

fn client_name(platform: Platform) -> &'static str {
    match platform {
        Platform::Steam => "Steam",
        Platform::Epic => "Epic Games",
        Platform::Gog => "GOG",
    }
}

// ── Sesión de juego ─────────────────────────────────────────────────────

/// Lanza el juego y deja un hilo vigilando su ciclo de vida.
pub fn start(app: &AppHandle, state: &AppState, req: LaunchRequest) -> Result<(), String> {
    let dir = install_dir(state, req.platform, &req.external_id);
    launch(state, req.platform, &req.external_id)?;

    // Un solo juego vigilado a la vez: si había otro, se restaura antes.
    end_session(state, "nuevo lanzamiento");
    let generation = state.generation.fetch_add(1, Ordering::SeqCst) + 1;
    *state.session.lock().unwrap_or_else(|e| e.into_inner()) = Some(Session {
        generation,
        title: req.title.clone(),
        adjusted: Vec::new(),
    });

    let (app, state) = (app.clone(), state.clone());
    std::thread::Builder::new()
        .name("lphoton-launch-watch".into())
        .spawn(move || watch(app, state, generation, req, dir))
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Termina la sesión activa (si hay) y restaura el modo ligero.
pub fn end_session(state: &AppState, reason: &str) {
    state.generation.fetch_add(1, Ordering::SeqCst);
    let session = state.session.lock().unwrap_or_else(|e| e.into_inner()).take();
    if let Some(mut session) = session {
        let procs = processes::fresh_snapshot();
        let restored = lightmode::restore(&procs, &mut session.adjusted);
        state.db.save_pending_lightmode(&[]);
        crate::log_line(state, &format!("session_end reason=\"{reason}\" game=\"{}\" restored={restored}", session.title));
    }
}

fn watch(app: AppHandle, state: AppState, generation: u64, req: LaunchRequest, dir: Option<PathBuf>) {
    let alive = || state.generation.load(Ordering::SeqCst) == generation;
    let emit = |step: &'static str, progress: f32, detail: Option<String>| {
        let _ = app.emit("launch-progress", ProgressEvent { game_id: &req.game_id, step, progress, detail });
    };
    let fail = |message: String| {
        crate::log_line(&state, &format!("launch_watch error game=\"{}\": {message}", req.title));
        let _ = app.emit("launch-error", ErrorEvent { game_id: &req.game_id, message });
    };
    let total_steps = if req.light_mode { 4.0 } else { 3.0 };

    // 1. Cliente nativo abierto (GOG no lo necesita).
    if let Some(exe) = client_exe(req.platform) {
        let found = wait_until(&alive, CLIENT_TIMEOUT, |procs| !processes::named(procs, &[exe]).is_empty());
        if !alive() {
            return;
        }
        if found.is_none() {
            fail(format!("{} no se abrió. Ábrelo manualmente e intenta de nuevo.", client_name(req.platform)));
            end_session(&state, "cliente no abrió");
            return;
        }
    }
    emit("client-started", 1.0 / total_steps, None);

    // Sin carpeta conocida (juego no instalado): el cliente se hace cargo.
    let Some(dir) = dir else {
        let message = format!("Continúa en {} para instalar o abrir el juego.", client_name(req.platform));
        let _ = app.emit("launch-done", DoneEvent { game_id: &req.game_id, outcome: "handoff", message: Some(message) });
        end_session(&state, "sin carpeta de instalación");
        return;
    };

    // 2. Aparece un proceso dentro de la carpeta del juego → licencia validada.
    if wait_until(&alive, GAME_TIMEOUT, |procs| !processes::under_dir(procs, &dir).is_empty()).is_none() {
        if alive() {
            fail(format!("El juego no se abrió. Revisa si {} muestra algún aviso.", client_name(req.platform)));
            end_session(&state, "juego no abrió");
        }
        return;
    }
    emit("license-validated", 2.0 / total_steps, None);

    // 3. Sigue vivo unos segundos → proceso del juego detectado.
    let stable_since = Instant::now();
    while stable_since.elapsed() < STABLE_FOR {
        std::thread::sleep(POLL);
        if !alive() {
            return;
        }
        if processes::under_dir(&processes::fresh_snapshot(), &dir).is_empty() {
            // Era un lanzador intermedio: esperar el proceso definitivo.
            if wait_until(&alive, GAME_TIMEOUT, |procs| !processes::under_dir(procs, &dir).is_empty()).is_none() {
                if alive() {
                    fail("El juego se cerró al iniciar.".into());
                    end_session(&state, "juego se cerró al iniciar");
                }
                return;
            }
        }
    }
    emit("game-detected", 3.0 / total_steps, None);

    // 4. Modo ligero.
    let targets = state.db.lightmode_targets();
    if req.light_mode {
        let report = apply_light_mode(&state, &targets);
        crate::log_line(
            &state,
            &format!("lightmode_applied adjusted={} failed={} freed_mb={}", report.adjusted, report.failed, report.freed_mb),
        );
        let detail = if report.adjusted == 0 && report.failed > 0 {
            "No pudimos ajustar los procesos en segundo plano, pero el juego sigue abriéndose.".to_string()
        } else if report.freed_mb > 0 {
            format!("Se liberaron {} MB de RAM para mejorar tus FPS.", report.freed_mb)
        } else {
            "Procesos en segundo plano suspendidos".to_string()
        };
        emit("light-mode-applied", 1.0, Some(detail));
    }

    let _ = app.emit("launch-done", DoneEvent { game_id: &req.game_id, outcome: "playing", message: None });

    // 5. A la bandeja: se destruye el WebView (RNF6).
    std::thread::sleep(MINIMIZE_DELAY);
    if !alive() {
        return;
    }
    let tooltip = format!("LPhoton · jugando {}", req.title);
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || tray::minimize_to_tray(&handle, &tooltip));
    let minimized_at = Instant::now();
    let mut ram_logged = false;

    // 6. Vigilar hasta que el juego se cierre.
    let mut last_seen = Instant::now();
    let mut last_reapply = Instant::now();
    loop {
        std::thread::sleep(Duration::from_secs(2));
        if !alive() {
            return;
        }
        let procs = processes::fresh_snapshot();
        if !processes::under_dir(&procs, &dir).is_empty() {
            last_seen = Instant::now();
        } else if last_seen.elapsed() >= CLOSED_AFTER {
            end_session(&state, "juego cerrado");
            let handle = app.clone();
            let _ = app.run_on_main_thread(move || tray::ensure(&handle, "LPhoton"));
            return;
        }
        if !ram_logged && minimized_at.elapsed() >= RAM_SAMPLE_AFTER {
            ram_logged = true;
            let ram = processes::total_mb(processes::tree(&procs, std::process::id()));
            crate::log_line(&state, &format!("ram_playing_mb={ram} game=\"{}\"", req.title));
        }
        // Steam y Epic crean webhelpers nuevos: se les aplica también el modo ligero.
        if req.light_mode && last_reapply.elapsed() >= REAPPLY_EVERY {
            last_reapply = Instant::now();
            let report = apply_light_mode(&state, &targets);
            if report.adjusted > 0 {
                crate::log_line(&state, &format!("lightmode_reapplied adjusted={}", report.adjusted));
            }
        }
    }
}

fn apply_light_mode(state: &AppState, targets: &[String]) -> lightmode::ApplyReport {
    let procs = processes::fresh_snapshot();
    let mut guard = state.session.lock().unwrap_or_else(|e| e.into_inner());
    match guard.as_mut() {
        Some(session) => {
            let report = lightmode::apply(&procs, targets, &mut session.adjusted);
            // Se guarda en disco por si LPhoton se cierra de golpe (ver `recover_pending`).
            state.db.save_pending_lightmode(&session.adjusted);
            report
        }
        None => lightmode::ApplyReport::default(),
    }
}

/// Al arrancar: restaura lo que una sesión anterior dejó modificado (cierre
/// inesperado de LPhoton mientras se jugaba).
pub fn recover_pending(state: &AppState) {
    let mut pending = state.db.take_pending_lightmode();
    if pending.is_empty() {
        return;
    }
    let total = pending.len();
    let restored = lightmode::restore(&processes::fresh_snapshot(), &mut pending);
    crate::log_line(state, &format!("lightmode_recovered pending={total} restored={restored}"));
}

/// Espera (sondeando) hasta que `check` sea verdadero. `None` si se agota el tiempo o se canceló.
fn wait_until(alive: &impl Fn() -> bool, timeout: Duration, check: impl Fn(&[Proc]) -> bool) -> Option<()> {
    let start = Instant::now();
    while start.elapsed() < timeout {
        if !alive() {
            return None;
        }
        if check(&processes::fresh_snapshot()) {
            return Some(());
        }
        std::thread::sleep(POLL);
    }
    None
}
