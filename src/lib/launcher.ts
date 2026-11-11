// Wrapper de la ejecución intervenida (RF2, §7.2) y su progreso (pantalla 6.5).
// Fase 2: el lanzamiento es real (Steam en modo silencioso + steam://rungameid).
// Los pasos de progreso siguen simulados hasta la fase 4, cuando launcher.rs
// emitirá el evento `launch-progress` (se escuchará con `listen()`).
// La firma (callback + función para cancelar) se mantiene igual.

import type { LaunchProgress, LaunchStep, Platform } from "../types";
import { errorMessage, inTauri, invoke } from "./tauri";

export interface LaunchOptions {
  gameId: string;
  platform: Platform;
  externalId: string;
  lightMode: boolean;
}

export const LAUNCH_STEP_LABELS: Record<LaunchStep, string> = {
  "client-started": "Cliente iniciado en modo silencioso",
  "license-validated": "Licencia validada",
  "game-detected": "Proceso del juego detectado",
  "light-mode-applied": "Modo ligero aplicado",
};

const STEP_DELAY_MS = 900;

// Evita lanzar dos veces el mismo juego si la pantalla se monta de nuevo
// (React StrictMode en desarrollo, o volver atrás y adelante enseguida).
const RELAUNCH_GUARD_MS = 5000;
let lastLaunch: { key: string; at: number; result: Promise<unknown> } | null = null;

/**
 * Inicia el juego y notifica cada paso. Si el lanzamiento falla se llama a
 * `onError` y se detiene el progreso. Devuelve una función para cancelar
 * la suscripción (al desmontar la pantalla de carga).
 */
export function launchGame(
  options: LaunchOptions,
  onProgress: (p: LaunchProgress) => void,
  onError: (message: string) => void,
): () => void {
  let cancelled = false;
  const steps: LaunchStep[] = ["client-started", "license-validated", "game-detected"];
  if (options.lightMode) steps.push("light-mode-applied");

  const timers = steps.map((step, i) =>
    setTimeout(() => !cancelled && onProgress({ step, progress: (i + 1) / steps.length }), STEP_DELAY_MS * (i + 1)),
  );
  const stop = () => {
    cancelled = true;
    timers.forEach(clearTimeout);
  };

  const key = `${options.platform}:${options.externalId}`;
  const now = Date.now();
  const recentlyLaunched = lastLaunch?.key === key && now - lastLaunch.at < RELAUNCH_GUARD_MS;
  if (inTauri) {
    if (!lastLaunch || !recentlyLaunched) {
      const result = invoke("launch_game", { platform: options.platform, externalId: options.externalId });
      lastLaunch = { key, at: now, result };
    }
    // Si la pantalla se montó dos veces, la segunda también recibe el error del único lanzamiento.
    lastLaunch.result.catch((err) => {
      if (cancelled) return;
      stop();
      onError(errorMessage(err, "No pudimos iniciar el juego."));
    });
  }
  return stop;
}
