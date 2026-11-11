// Wrapper de métricas de LPhoton (etiqueta CPU/RAM de la ficha, §6.3).
// Fase 1: valores simulados cercanos a los de la maqueta. Fase 6:
// `invoke<AppMetrics>("get_app_metrics")` usando el crate `sysinfo`.

import type { AppMetrics } from "../types";

export async function getAppMetrics(): Promise<AppMetrics> {
  const jitter = (base: number, spread: number) => base + (Math.random() - 0.5) * spread;
  return {
    cpuPercent: Math.max(0.1, Number(jitter(1.2, 0.6).toFixed(1))),
    ramMb: Math.round(jitter(74, 4)),
  };
}
