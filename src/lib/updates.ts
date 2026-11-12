// Actualizaciones automáticas (tauri-plugin-updater). LPhoton busca un `latest.json`
// en el último release de GitHub; el instalador viene firmado y se verifica con la
// clave pública de tauri.conf.json antes de instalarse.

import { inTauri } from "./tauri";

export interface AvailableUpdate {
  version: string;
  notes: string | null;
  /** Descarga, instala y reinicia LPhoton. `onProgress` recibe 0..1 (o null si no se sabe el tamaño). */
  install: (onProgress: (fraction: number | null) => void) => Promise<void>;
}

/** Devuelve la actualización disponible, o null si LPhoton está al día (o en el modo demo). */
export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  if (!inTauri) return null;
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  if (!update) return null;
  return {
    version: update.version,
    notes: update.body ?? null,
    install: async (onProgress) => {
      let total = 0;
      let done = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") total = event.data.contentLength ?? 0;
        if (event.event === "Progress") {
          done += event.data.chunkLength;
          onProgress(total > 0 ? Math.min(1, done / total) : null);
        }
      });
      // En Windows el instalador cierra LPhoton; si sigue abierto, se reinicia.
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    },
  };
}
