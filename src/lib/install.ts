// Instalación de juegos que están en la biblioteca pero no en el equipo.
// LPhoton no descarga nada por su cuenta: abre la instalación en el cliente de
// la tienda (Steam, Epic o GOG Galaxy). En Steam, además, sigue el progreso
// leyendo el appmanifest del juego.

import type { GameSource } from "../types";
import { inTauri, invoke } from "./tauri";

export type InstallState = "none" | "queued" | "downloading" | "installed";

export interface InstallStatus {
  state: InstallState;
  downloadedBytes: number;
  totalBytes: number;
}

export async function installGame(source: GameSource): Promise<void> {
  if (inTauri) {
    await invoke("install_game", { platform: source.platform, externalId: source.externalId });
    return;
  }
  demoStarted.set(source.externalId, Date.now());
}

// Modo demo: una descarga simulada de 8 GB que dura ~12 s.
const demoStarted = new Map<string, number>();
const DEMO_TOTAL = 8 * 1024 ** 3;

export async function getInstallStatus(appid: string): Promise<InstallStatus> {
  if (inTauri) return invoke<InstallStatus>("install_status", { appid: Number(appid) });
  const started = demoStarted.get(appid);
  if (!started) return { state: "none", downloadedBytes: 0, totalBytes: 0 };
  const elapsed = Date.now() - started;
  if (elapsed < 2000) return { state: "queued", downloadedBytes: 0, totalBytes: 0 };
  const done = Math.min(1, (elapsed - 2000) / 10000);
  return { state: "downloading", downloadedBytes: Math.round(done * DEMO_TOTAL), totalBytes: DEMO_TOTAL };
}

export function formatBytes(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toLocaleString("es-CL", { maximumFractionDigits: 1 })} GB`;
  return `${Math.round(bytes / 1024 ** 2).toLocaleString("es-CL")} MB`;
}
