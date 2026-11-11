//! Métricas de LPhoton (etiqueta CPU/RAM de la ficha, §6.3): el proceso de
//! LPhoton más sus procesos WebView2 hijos, medidos con `sysinfo`.

use serde::Serialize;

use crate::processes;
use crate::AppState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppMetrics {
    pub cpu_percent: f32,
    pub ram_mb: u64,
}

pub fn app_metrics(state: &AppState) -> AppMetrics {
    let mut sys = state.metrics_sys.lock().unwrap_or_else(|e| e.into_inner());
    // El uso de CPU de sysinfo se calcula entre dos refrescos: se reutiliza el mismo `System`.
    processes::refresh(&mut sys);
    let procs = processes::snapshot(&sys);
    let tree = processes::tree(&procs, std::process::id());
    let cores = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1) as f32;
    AppMetrics {
        cpu_percent: (tree.iter().map(|p| p.cpu).sum::<f32>() / cores * 10.0).round() / 10.0,
        ram_mb: processes::total_mb(tree),
    }
}
