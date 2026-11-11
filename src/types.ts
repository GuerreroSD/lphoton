// Modelos compartidos entre la UI y los wrappers de src/lib/.
// Deben coincidir con los structs serializados por el backend Rust (fases 2+).

export type Platform = "steam" | "epic" | "gog";

export const PLATFORM_NAMES: Record<Platform, string> = {
  steam: "Steam",
  epic: "Epic Games",
  gog: "GOG",
};

/** Un juego en una tienda concreta. Un mismo `Game` puede tener varias. */
export interface GameSource {
  platform: Platform;
  /** AppID de Steam, AppName de Epic o productId de GOG. */
  externalId: string;
  installed: boolean;
  playtimeMinutes: number;
  /** ISO 8601, o null si nunca se jugó. */
  lastPlayed: string | null;
}

export interface Game {
  id: string;
  title: string;
  sources: GameSource[];
  genre: string;
  developer: string;
  protagonist: string;
  releaseYear: number;
  description: string;
  /** Portada vertical 2:3 (600×900). */
  coverUrl: string;
  /** Banner horizontal para la ficha. */
  heroUrl: string;
}

export interface AppMetrics {
  cpuPercent: number;
  ramMb: number;
}

export interface ClientLoad {
  platform: Platform;
  /** true si el cliente nativo consume muchos recursos en segundo plano. */
  high: boolean;
  ramMb: number;
}

export type LaunchStep = "client-started" | "license-validated" | "game-detected" | "light-mode-applied";

export interface LaunchProgress {
  step: LaunchStep;
  /** 0..1 */
  progress: number;
}

export type LightModePreference = "ask" | "always" | "never";
export type Theme = "dark" | "light";
