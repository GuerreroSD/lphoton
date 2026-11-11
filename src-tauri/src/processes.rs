//! Lectura de procesos con `sysinfo`: juego en ejecución, consumo del cliente
//! nativo y consumo de LPhoton (proceso + WebView2 hijos).

use std::collections::HashSet;
use std::path::Path;

use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};

/// Info mínima que se necesita de cada proceso.
#[derive(Debug, Clone)]
pub struct Proc {
    pub pid: u32,
    pub parent: Option<u32>,
    pub name: String,
    pub exe: Option<String>,
    pub memory: u64,
    pub start_time: u64,
    pub cpu: f32,
}

/// Refresca la lista de procesos (memoria, CPU y ruta del ejecutable).
pub fn refresh(sys: &mut System) {
    sys.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::nothing().with_memory().with_cpu().with_exe(UpdateKind::OnlyIfNotSet),
    );
}

pub fn snapshot(sys: &System) -> Vec<Proc> {
    sys.processes()
        .values()
        .map(|p| Proc {
            pid: p.pid().as_u32(),
            parent: p.parent().map(Pid::as_u32),
            name: p.name().to_string_lossy().into_owned(),
            exe: p.exe().map(|e| e.to_string_lossy().into_owned()),
            memory: p.memory(),
            start_time: p.start_time(),
            cpu: p.cpu_usage(),
        })
        .collect()
}

pub fn fresh_snapshot() -> Vec<Proc> {
    let mut sys = System::new();
    refresh(&mut sys);
    snapshot(&sys)
}

fn normalize(path: &str) -> String {
    path.replace('/', "\\").trim_end_matches('\\').to_lowercase()
}

/// Procesos cuyo ejecutable está dentro de `dir` (el juego y sus lanzadores).
pub fn under_dir<'a>(procs: &'a [Proc], dir: &Path) -> Vec<&'a Proc> {
    let prefix = format!("{}\\", normalize(&dir.to_string_lossy()));
    procs
        .iter()
        .filter(|p| p.exe.as_deref().is_some_and(|exe| normalize(exe).starts_with(&prefix)))
        .collect()
}

pub fn named<'a>(procs: &'a [Proc], names: &[&str]) -> Vec<&'a Proc> {
    procs
        .iter()
        .filter(|p| names.iter().any(|n| p.name.eq_ignore_ascii_case(n)))
        .collect()
}

pub fn total_mb<'a>(procs: impl IntoIterator<Item = &'a Proc>) -> u64 {
    procs.into_iter().map(|p| p.memory).sum::<u64>() / (1024 * 1024)
}

/// El proceso `root` y todos sus descendientes (LPhoton + WebView2).
pub fn tree(procs: &[Proc], root: u32) -> Vec<&Proc> {
    let mut ids: HashSet<u32> = HashSet::from([root]);
    // Pocas pasadas bastan: el árbol de WebView2 tiene 2-3 niveles.
    loop {
        let before = ids.len();
        for p in procs {
            if p.parent.is_some_and(|parent| ids.contains(&parent)) {
                ids.insert(p.pid);
            }
        }
        if ids.len() == before {
            break;
        }
    }
    procs.iter().filter(|p| ids.contains(&p.pid)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn proc(pid: u32, parent: Option<u32>, name: &str, exe: &str, mb: u64) -> Proc {
        Proc {
            pid,
            parent,
            name: name.into(),
            exe: Some(exe.into()),
            memory: mb * 1024 * 1024,
            start_time: 0,
            cpu: 0.0,
        }
    }

    #[test]
    fn finds_game_processes_by_install_dir() {
        let procs = vec![
            proc(1, None, "game.exe", r"C:\Games\Juego\bin\game.exe", 100),
            proc(2, None, "otro.exe", r"C:\Games\JuegoDos\otro.exe", 50),
            proc(3, None, "steam.exe", r"C:\Program Files (x86)\Steam\steam.exe", 80),
        ];
        let found = under_dir(&procs, Path::new("c:/games/juego"));
        assert_eq!(found.iter().map(|p| p.pid).collect::<Vec<_>>(), vec![1]);
    }

    #[test]
    fn sums_process_tree() {
        let procs = vec![
            proc(10, None, "lphoton.exe", "x", 20),
            proc(11, Some(10), "msedgewebview2.exe", "x", 30),
            proc(12, Some(11), "msedgewebview2.exe", "x", 40),
            proc(13, Some(99), "ajeno.exe", "x", 500),
        ];
        assert_eq!(total_mb(tree(&procs, 10)), 90);
        assert_eq!(total_mb(named(&procs, &["MSEDGEWEBVIEW2.EXE"])), 70);
    }
}
