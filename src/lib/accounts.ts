// Wrapper de cuentas y vinculación de plataformas (RF1, pantalla 6.1).
// Fase 1: simulado. Fase 2+: `invoke("link_platform", { platform })`; las
// credenciales/API keys se guardan en el backend con `keyring`, nunca aquí.

import type { Platform } from "../types";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface Session {
  username: string;
}

export async function login(username: string, password: string): Promise<Session> {
  await delay(250);
  if (!username.trim() || !password) {
    throw new Error("Ingresa tu usuario y contraseña.");
  }
  return { username: username.trim() };
}

export async function linkPlatform(platform: Platform): Promise<Platform> {
  await delay(300);
  return platform;
}

export async function unlinkPlatform(platform: Platform): Promise<Platform> {
  await delay(150);
  return platform;
}
