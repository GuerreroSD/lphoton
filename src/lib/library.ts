// Wrapper de la biblioteca unificada (RF1).
// Fase 1: devuelve datos simulados. Fases 2-3: reemplazar el cuerpo por
// `invoke<Game[]>("get_library")` (caché SQLite + sincronización en segundo plano)
// sin cambiar la firma, para que la UI no se toque.

import mockGames from "../mock/mock-games.json";
import type { Game, Platform } from "../types";

const games = mockGames as Game[];

/** Orden alfabético natural ("Resident Evil 2" antes que "Resident Evil 10"). */
export function compareTitles(a: Game, b: Game): number {
  return a.title.localeCompare(b.title, "es", { numeric: true, sensitivity: "base" });
}

/** Fecha de la última sesión en cualquier plataforma (ms), o 0. */
export function lastPlayedAt(game: Game): number {
  return game.sources.reduce((max, s) => {
    const t = s.lastPlayed ? Date.parse(s.lastPlayed) : 0;
    return t > max ? t : max;
  }, 0);
}

export function totalPlaytimeMinutes(game: Game): number {
  return game.sources.reduce((sum, s) => sum + s.playtimeMinutes, 0);
}

/** Plataforma con la que se lanzará el juego: la instalada, si no la primera. */
export function preferredSource(game: Game) {
  return game.sources.find((s) => s.installed) ?? game.sources[0];
}

export async function getLibrary(): Promise<Game[]> {
  return games.slice();
}

export async function getGame(id: string): Promise<Game | undefined> {
  return games.find((g) => g.id === id);
}

/** Cantidad de juegos detectados para un conjunto de plataformas vinculadas. */
export async function countGamesFor(platforms: Platform[]): Promise<number> {
  return games.filter((g) => g.sources.some((s) => platforms.includes(s.platform))).length;
}
