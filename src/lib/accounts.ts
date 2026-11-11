// Wrapper de cuentas y vinculación de plataformas (RF1, pantalla 6.1).
// Steam es real desde la fase 2: se detecta la instalación local y, de forma
// opcional, se guarda la API key en el administrador de credenciales de Windows
// (desde Rust con `keyring`; nunca pasa por localStorage).

import type { Platform, SteamStatus } from "../types";
import { inTauri, invoke } from "./tauri";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface Session {
  username: string;
}

/** Plataformas integradas (las tres desde la fase 3). */
export function isPlatformAvailable(platform: Platform): boolean {
  return platform === "steam" || platform === "epic" || platform === "gog";
}

export type PlatformsStatus = Record<Platform, boolean>;

/** Qué clientes están instalados en este equipo. */
export async function getPlatformsStatus(): Promise<PlatformsStatus> {
  if (!inTauri) return { steam: true, epic: true, gog: true };
  return invoke<PlatformsStatus>("platforms_status");
}

const NOT_FOUND_MESSAGES: Record<Platform, string> = {
  steam: "No encontramos Steam en este equipo. Instálalo e inicia sesión una vez.",
  epic: "No encontramos Epic Games Launcher ni juegos instalados con él.",
  gog: "No encontramos GOG Galaxy ni juegos de GOG instalados en este equipo.",
};

export async function login(username: string, password: string): Promise<Session> {
  await delay(250);
  if (!username.trim() || !password) {
    throw new Error("Ingresa tu usuario y contraseña.");
  }
  return { username: username.trim() };
}

export async function getSteamStatus(): Promise<SteamStatus> {
  if (!inTauri) return { detected: true, steamId: null, hasApiKey: false };
  return invoke<SteamStatus>("steam_status");
}

/**
 * Vincula una plataforma: exige que su cliente (o sus juegos) esté en el equipo.
 * Lanza un Error con un mensaje para el usuario si no se puede.
 */
export async function linkPlatform(platform: Platform): Promise<Platform> {
  if (!inTauri) {
    await delay(300);
    return platform;
  }
  const status = await getPlatformsStatus();
  if (!status[platform]) throw new Error(NOT_FOUND_MESSAGES[platform]);
  return platform;
}

export async function unlinkPlatform(platform: Platform): Promise<Platform> {
  await delay(150);
  return platform;
}

/** Valida y guarda la API key. Devuelve cuántos juegos tiene la cuenta. */
export async function saveSteamApiKey(key: string): Promise<number> {
  if (!inTauri) {
    await delay(400);
    return 14;
  }
  return invoke<number>("set_steam_api_key", { key });
}

export async function removeSteamApiKey(): Promise<void> {
  if (!inTauri) return;
  await invoke("clear_steam_api_key");
}

export const STEAM_API_KEY_URL = "https://steamcommunity.com/dev/apikey";
