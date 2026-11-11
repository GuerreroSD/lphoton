// Wrapper de Configuraciones del sistema (§6.7): iniciar con Windows, rutas
// de instalación, lista de procesos del modo ligero y versión.
// En el navegador (modo demo) se simulan con localStorage.

import type { Platform } from "../types";
import { inTauri, invoke } from "./tauri";

export interface InstallPath {
  platform: Platform;
  path: string;
  games: number;
}

/** Igual que lightmode.rs (DEFAULT_TARGETS y PROTECTED). */
export const DEFAULT_LIGHTMODE_TARGETS = [
  "steamwebhelper.exe",
  "EpicWebHelper.exe",
  "GalaxyClient Helper.exe",
  "GalaxyCommunication.exe",
];
const PROTECTED = ["steam.exe", "epicgameslauncher.exe", "galaxyclient.exe", "lphoton.exe"];

/** Valida un nombre de proceso antes de agregarlo a la lista. */
export function validateTarget(name: string, current: string[]): string | null {
  const clean = name.trim();
  if (!clean) return "Escribe el nombre del proceso.";
  if (!clean.toLowerCase().endsWith(".exe") || clean.length > 64 || /[\\/]/.test(clean)) {
    return "Escribe solo el nombre del ejecutable, por ejemplo steamwebhelper.exe.";
  }
  if (PROTECTED.includes(clean.toLowerCase())) {
    return "Ese es el proceso principal del cliente: nunca se modifica (rompería el DRM o el guardado en la nube).";
  }
  if (current.some((t) => t.toLowerCase() === clean.toLowerCase())) return "Ese proceso ya está en la lista.";
  return null;
}

const DEMO_AUTOSTART = "lphoton-demo-autostart";
const DEMO_TARGETS = "lphoton-demo-targets";

function demoGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function demoSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* sin persistencia en el modo demo */
  }
}

export async function getAutostart(): Promise<boolean> {
  if (inTauri) return invoke<boolean>("get_autostart");
  return demoGet(DEMO_AUTOSTART) === "1";
}

export async function setAutostart(enabled: boolean): Promise<boolean> {
  if (inTauri) return invoke<boolean>("set_autostart", { enabled });
  demoSet(DEMO_AUTOSTART, enabled ? "1" : "0");
  return enabled;
}

export async function getInstallPaths(): Promise<InstallPath[]> {
  if (inTauri) return invoke<InstallPath[]>("install_paths");
  return [
    { platform: "steam", path: "C:\\Program Files (x86)\\Steam\\steamapps\\common", games: 9 },
    { platform: "epic", path: "C:\\Program Files\\Epic Games", games: 2 },
  ];
}

export async function openInstallPath(path: string): Promise<void> {
  if (inTauri) await invoke("open_install_path", { path });
}

export async function getLightmodeTargets(): Promise<string[]> {
  if (inTauri) return invoke<string[]>("get_lightmode_targets");
  try {
    return JSON.parse(demoGet(DEMO_TARGETS) ?? "null") ?? DEFAULT_LIGHTMODE_TARGETS;
  } catch {
    return DEFAULT_LIGHTMODE_TARGETS;
  }
}

export async function setLightmodeTargets(targets: string[]): Promise<string[]> {
  if (inTauri) return invoke<string[]>("set_lightmode_targets", { targets });
  demoSet(DEMO_TARGETS, JSON.stringify(targets));
  return targets;
}

export async function getAppVersion(): Promise<string> {
  if (inTauri) return invoke<string>("app_version");
  return "demo";
}
