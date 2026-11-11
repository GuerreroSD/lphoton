// Utilidades comunes de los wrappers. Si la UI corre en un navegador normal
// (`npm run dev`), los wrappers usan los datos simulados de src/mock/.

import { invoke, isTauri } from "@tauri-apps/api/core";

/** true dentro de la app de escritorio; false en el navegador (modo demo). */
export const inTauri = isTauri();

export { invoke };

/** Mensaje legible a partir de un error de `invoke` (Rust devuelve strings). */
export function errorMessage(err: unknown, fallback = "Algo salió mal. Intenta de nuevo."): string {
  if (typeof err === "string" && err) return err;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/**
 * URL del protocolo `cover://` del backend (portadas con caché en disco).
 * En Windows Tauri expone los protocolos propios como http://<esquema>.localhost.
 */
export function coverSrc(platform: string, externalId: string, kind: "cover" | "hero"): string {
  const path = `${platform}/${encodeURIComponent(externalId)}/${kind}`;
  return navigator.userAgent.includes("Windows") ? `http://cover.localhost/${path}` : `cover://localhost/${path}`;
}

/** Abre un enlace en el navegador del sistema (no dentro de LPhoton). */
export async function openExternal(url: string): Promise<void> {
  if (!inTauri) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  const { openUrl } = await import("@tauri-apps/plugin-opener");
  await openUrl(url);
}
