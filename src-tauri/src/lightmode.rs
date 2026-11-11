//! Modo ligero (RF3, LPHOTON.md §7.3).
//!
//! Se aplica DESPUÉS de detectar el proceso del juego (licencia ya validada):
//! `SetPriorityClass(IDLE)` + `EmptyWorkingSet` sobre los procesos auxiliares
//! configurables (webhelpers). Nunca se toca el proceso principal del cliente
//! (`steam.exe`, `EpicGamesLauncher.exe`, `GalaxyClient.exe`): rompería el DRM,
//! el guardado en la nube o el multijugador. Al cerrar el juego se restaura la
//! prioridad original de todo lo modificado.

use serde::{Deserialize, Serialize};

use crate::models::Platform;
use crate::processes::{self, Proc};

/// Procesos objetivo por defecto (lista configurable, ver `db` meta `lightmode_targets`).
pub const DEFAULT_TARGETS: &[&str] = &[
    "steamwebhelper.exe",
    "EpicWebHelper.exe",
    "GalaxyClient Helper.exe",
    "GalaxyCommunication.exe",
];

/// Jamás se modifican, aunque el usuario los agregue a la lista.
const PROTECTED: &[&str] = &["steam.exe", "EpicGamesLauncher.exe", "GalaxyClient.exe", "lphoton.exe"];

/// Umbral (MB) del cliente nativo a partir del cual se ofrece el modo ligero.
pub const HIGH_CLIENT_RAM_MB: u64 = 300;

/// Un proceso modificado, para poder restaurarlo (pid + hora de inicio evitan
/// restaurar por error un proceso nuevo que reutilizó el mismo pid).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Adjusted {
    pub pid: u32,
    pub start_time: u64,
    pub name: String,
    pub original_priority: u32,
}

#[derive(Debug, Default, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyReport {
    pub adjusted: usize,
    pub failed: usize,
    pub freed_mb: u64,
}

pub fn is_protected(name: &str) -> bool {
    PROTECTED.iter().any(|p| p.eq_ignore_ascii_case(name))
}

/// Aplica el modo ligero a los procesos objetivo que aún no estén en `session`.
pub fn apply(procs: &[Proc], targets: &[String], session: &mut Vec<Adjusted>) -> ApplyReport {
    let mut report = ApplyReport::default();
    let target_refs: Vec<&str> = targets.iter().map(String::as_str).collect();
    let candidates: Vec<&Proc> = processes::named(procs, &target_refs)
        .into_iter()
        .filter(|p| !is_protected(&p.name))
        .filter(|p| !session.iter().any(|a| a.pid == p.pid && a.start_time == p.start_time))
        .collect();
    let before_mb = processes::total_mb(candidates.iter().copied());

    #[cfg(windows)]
    for p in &candidates {
        use crate::platform::windows as win;
        let original = match win::priority(p.pid) {
            Ok(class) => class,
            Err(_) => {
                report.failed += 1;
                continue;
            }
        };
        if win::set_priority(p.pid, win::IDLE_PRIORITY).is_err() {
            report.failed += 1;
            continue;
        }
        // Si vaciar la memoria falla, la prioridad baja igual cuenta como aplicada.
        let _ = win::empty_working_set(p.pid);
        session.push(Adjusted {
            pid: p.pid,
            start_time: p.start_time,
            name: p.name.clone(),
            original_priority: original,
        });
        report.adjusted += 1;
    }

    if report.adjusted > 0 {
        let after = processes::fresh_snapshot();
        let still: Vec<&Proc> = after
            .iter()
            .filter(|p| candidates.iter().any(|c| c.pid == p.pid && c.start_time == p.start_time))
            .collect();
        report.freed_mb = before_mb.saturating_sub(processes::total_mb(still));
    }
    report
}

/// Restaura la prioridad original. Devuelve cuántos procesos se restauraron.
pub fn restore(procs: &[Proc], session: &mut Vec<Adjusted>) -> usize {
    let mut restored = 0;
    for adjusted in session.drain(..) {
        let alive = procs.iter().any(|p| p.pid == adjusted.pid && p.start_time == adjusted.start_time);
        if !alive {
            continue;
        }
        #[cfg(windows)]
        if crate::platform::windows::set_priority(adjusted.pid, adjusted.original_priority).is_ok() {
            restored += 1;
        }
    }
    restored
}

/// Procesos del cliente nativo de cada plataforma (principal + auxiliares).
pub fn client_processes(platform: Platform) -> &'static [&'static str] {
    match platform {
        Platform::Steam => &["steam.exe", "steamwebhelper.exe"],
        Platform::Epic => &["EpicGamesLauncher.exe", "EpicWebHelper.exe"],
        Platform::Gog => &["GalaxyClient.exe", "GalaxyClient Helper.exe", "GalaxyCommunication.exe"],
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientLoad {
    pub platform: Platform,
    pub running: bool,
    pub ram_mb: u64,
    pub high: bool,
}

pub fn client_load(procs: &[Proc], platform: Platform) -> ClientLoad {
    let found = processes::named(procs, client_processes(platform));
    let ram_mb = processes::total_mb(found.iter().copied());
    ClientLoad { platform, running: !found.is_empty(), ram_mb, high: ram_mb >= HIGH_CLIENT_RAM_MB }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn proc(pid: u32, name: &str, mb: u64) -> Proc {
        Proc { pid, parent: None, name: name.into(), exe: None, memory: mb * 1024 * 1024, start_time: 1, cpu: 0.0 }
    }

    #[test]
    fn never_targets_main_client() {
        assert!(is_protected("STEAM.EXE"));
        assert!(is_protected("EpicGamesLauncher.exe"));
        assert!(!is_protected("steamwebhelper.exe"));
    }

    #[test]
    fn measures_client_load() {
        let procs = vec![proc(1, "steam.exe", 150), proc(2, "steamwebhelper.exe", 300), proc(3, "otro.exe", 900)];
        let load = client_load(&procs, Platform::Steam);
        assert!(load.running && load.high);
        assert_eq!(load.ram_mb, 450);
        assert!(!client_load(&procs, Platform::Epic).running);
    }

    #[test]
    fn protected_names_in_targets_are_ignored() {
        let procs = vec![proc(1, "steam.exe", 150)];
        let mut session = Vec::new();
        let report = apply(&procs, &["steam.exe".to_string()], &mut session);
        assert_eq!(report.adjusted, 0);
        assert!(session.is_empty());
    }
}

/// Prueba manual sobre los procesos reales (se restauran al final):
/// `cargo test real_lightmode -- --ignored --nocapture`.
#[cfg(all(test, windows))]
mod real_machine {
    use super::*;
    use crate::platform::windows as win;

    #[test]
    #[ignore]
    fn real_lightmode() {
        let procs = processes::fresh_snapshot();
        println!("carga steam: {:?}", client_load(&procs, Platform::Steam));
        let targets: Vec<String> = DEFAULT_TARGETS.iter().map(|s| s.to_string()).collect();
        let mut session = Vec::new();
        let report = apply(&procs, &targets, &mut session);
        println!("aplicado: {report:?}");
        for a in &session {
            println!("  {} pid={} prioridad {:#x} -> {:#x}", a.name, a.pid, a.original_priority, win::priority(a.pid).unwrap_or(0));
        }
        std::thread::sleep(std::time::Duration::from_secs(3));
        let snapshot: Vec<_> = session.clone();
        let restored = restore(&processes::fresh_snapshot(), &mut session);
        println!("restaurados: {restored}");
        for a in &snapshot {
            let now = win::priority(a.pid).unwrap_or(0);
            assert_eq!(now, a.original_priority, "{} no se restauró", a.name);
        }
    }
}
