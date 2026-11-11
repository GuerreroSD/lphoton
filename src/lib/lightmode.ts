// Wrapper del modo ligero (RF3, §7.3).
// En la app de escritorio mide el cliente nativo real (sysinfo, desde Rust).
// En el navegador (modo demo) devuelve valores simulados.

import type { ClientLoad, Platform } from "../types";
import { inTauri, invoke } from "./tauri";

/** Umbral (MB) a partir del cual se ofrece activar el modo ligero (igual que en lightmode.rs). */
export const HIGH_CLIENT_RAM_MB = 300;

const SIMULATED_CLIENT_RAM: Record<Platform, number> = {
  steam: 620,
  epic: 540,
  gog: 180,
};

export async function checkClientLoad(platform: Platform): Promise<ClientLoad> {
  if (inTauri) return invoke<ClientLoad>("check_client_load", { platform });
  const ramMb = SIMULATED_CLIENT_RAM[platform];
  return { platform, running: true, ramMb, high: ramMb >= HIGH_CLIENT_RAM_MB };
}
