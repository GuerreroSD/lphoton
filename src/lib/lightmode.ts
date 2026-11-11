// Wrapper del modo ligero (RF3, §7.3).
// Fase 1: simulado. Fase 4: `invoke<ClientLoad>("check_client_load", { platform })`
// que mide los webhelpers del cliente nativo con sysinfo.

import type { ClientLoad, Platform } from "../types";

/** Umbral (MB) a partir del cual se ofrece activar el modo ligero. */
export const HIGH_CLIENT_RAM_MB = 400;

const SIMULATED_CLIENT_RAM: Record<Platform, number> = {
  steam: 620,
  epic: 540,
  gog: 180,
};

export async function checkClientLoad(platform: Platform): Promise<ClientLoad> {
  const ramMb = SIMULATED_CLIENT_RAM[platform];
  return { platform, ramMb, high: ramMb >= HIGH_CLIENT_RAM_MB };
}
