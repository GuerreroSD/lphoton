// Wrapper de métricas de LPhoton (etiqueta CPU/RAM de la ficha, §6.3).
// En la app de escritorio: proceso de LPhoton + WebView2, medidos con sysinfo.
// En el navegador (modo demo): valores simulados cercanos a los de la maqueta.

import type { AppMetrics } from "../types";
import { inTauri, invoke } from "./tauri";

export async function getAppMetrics(): Promise<AppMetrics> {
  if (inTauri) return invoke<AppMetrics>("get_app_metrics");
  const jitter = (base: number, spread: number) => base + (Math.random() - 0.5) * spread;
  return {
    cpuPercent: Math.max(0.1, Number(jitter(1.2, 0.6).toFixed(1))),
    ramMb: Math.round(jitter(74, 4)),
  };
}
