// Wrapper de la ejecución intervenida (RF2, §7.2) y su progreso (pantalla 6.5).
// En la app de escritorio el progreso es real: launcher.rs vigila los procesos y
// emite `launch-progress`, `launch-done` y `launch-error`.
// En el navegador (modo demo) los pasos se simulan con temporizadores.

import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { LaunchProgress, LaunchStep, Platform } from "../types";
import { errorMessage, inTauri, invoke } from "./tauri";

export interface LaunchOptions {
  gameId: string;
  title: string;
  platform: Platform;
  externalId: string;
  lightMode: boolean;
}

export interface LaunchHandlers {
  onProgress: (p: LaunchProgress) => void;
  /** "playing": el juego está abierto (LPhoton pasa a la bandeja). "handoff": sigue en el cliente. */
  onDone: (outcome: "playing" | "handoff", message: string | null) => void;
  onError: (message: string) => void;
}

export const LAUNCH_STEP_LABELS: Record<LaunchStep, string> = {
  "client-started": "Cliente iniciado en modo silencioso",
  "license-validated": "Licencia validada",
  "game-detected": "Proceso del juego detectado",
  "light-mode-applied": "Modo ligero aplicado",
};

// Evita lanzar dos veces el mismo juego si la pantalla se monta de nuevo
// (React StrictMode en desarrollo, o volver atrás y adelante enseguida).
const RELAUNCH_GUARD_MS = 5000;
let lastLaunch: { key: string; at: number; result: Promise<unknown> } | null = null;

interface ProgressPayload {
  gameId: string;
  step: LaunchStep;
  progress: number;
  detail: string | null;
}

/** Inicia el juego y notifica cada paso. Devuelve una función para dejar de escuchar. */
export function launchGame(options: LaunchOptions, handlers: LaunchHandlers): () => void {
  return inTauri ? launchReal(options, handlers) : launchSimulated(options, handlers);
}

function launchReal(options: LaunchOptions, handlers: LaunchHandlers): () => void {
  let cancelled = false;
  const mine = (gameId: string) => !cancelled && gameId === options.gameId;

  const unlisteners: Promise<UnlistenFn>[] = [
    listen<ProgressPayload>("launch-progress", ({ payload }) => {
      if (mine(payload.gameId)) handlers.onProgress({ step: payload.step, progress: payload.progress, detail: payload.detail });
    }),
    listen<{ gameId: string; outcome: "playing" | "handoff"; message: string | null }>("launch-done", ({ payload }) => {
      if (mine(payload.gameId)) handlers.onDone(payload.outcome, payload.message);
    }),
    listen<{ gameId: string; message: string }>("launch-error", ({ payload }) => {
      if (mine(payload.gameId)) handlers.onError(payload.message);
    }),
  ];

  const key = `${options.platform}:${options.externalId}`;
  const now = Date.now();
  if (!lastLaunch || lastLaunch.key !== key || now - lastLaunch.at >= RELAUNCH_GUARD_MS) {
    // Se lanza recién cuando los listeners están listos, para no perder eventos.
    const result = Promise.all(unlisteners).then(() => invoke("launch_game", { request: options }));
    lastLaunch = { key, at: now, result };
  }
  lastLaunch.result.catch((err) => {
    if (!cancelled) handlers.onError(errorMessage(err, "No pudimos iniciar el juego."));
  });

  return () => {
    cancelled = true;
    unlisteners.forEach((p) => void p.then((unlisten) => unlisten()));
  };
}

const STEP_DELAY_MS = 900;

function launchSimulated(options: LaunchOptions, handlers: LaunchHandlers): () => void {
  const steps: LaunchStep[] = ["client-started", "license-validated", "game-detected"];
  if (options.lightMode) steps.push("light-mode-applied");
  const timers = steps.map((step, i) =>
    setTimeout(() => {
      const detail = step === "light-mode-applied" ? "Se liberaron 450 MB de RAM para mejorar tus FPS." : null;
      handlers.onProgress({ step, progress: (i + 1) / steps.length, detail });
      if (i === steps.length - 1) handlers.onDone("playing", null);
    }, STEP_DELAY_MS * (i + 1)),
  );
  return () => timers.forEach(clearTimeout);
}
