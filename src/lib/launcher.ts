// Wrapper de la ejecución intervenida (RF2, §7.2) y su progreso (pantalla 6.5).
// Fase 1: progreso simulado con temporizadores. Fase 4: `invoke("launch_game", …)`
// y escuchar el evento `launch-progress` emitido por launcher.rs con `listen()`.
// La firma (callback + función para cancelar) se mantiene igual.

import type { LaunchProgress, LaunchStep, Platform } from "../types";

export interface LaunchOptions {
  gameId: string;
  platform: Platform;
  lightMode: boolean;
}

export const LAUNCH_STEP_LABELS: Record<LaunchStep, string> = {
  "client-started": "Cliente iniciado en modo silencioso",
  "license-validated": "Licencia validada",
  "game-detected": "Proceso del juego detectado",
  "light-mode-applied": "Modo ligero aplicado",
};

const STEP_DELAY_MS = 900;

/**
 * Inicia el juego y notifica cada paso. Devuelve una función para cancelar
 * la suscripción (útil al desmontar la pantalla de carga).
 */
export function launchGame(options: LaunchOptions, onProgress: (p: LaunchProgress) => void): () => void {
  const steps: LaunchStep[] = ["client-started", "license-validated", "game-detected"];
  if (options.lightMode) steps.push("light-mode-applied");

  const timers = steps.map((step, i) =>
    setTimeout(() => onProgress({ step, progress: (i + 1) / steps.length }), STEP_DELAY_MS * (i + 1)),
  );
  return () => timers.forEach(clearTimeout);
}
