// Wrapper de la biblioteca unificada (RF1).
// En la app de escritorio usa los comandos de Rust (caché SQLite + Steam).
// En el navegador (`npm run dev`) devuelve los datos simulados de src/mock/.

import mockGames from "../mock/mock-games.json";
import type { Game, GameDetails, Platform, SyncResult } from "../types";
import { coverSrc, inTauri, invoke } from "./tauri";

const mock = mockGames as Game[];

/** Juego tal como lo envía Rust: sin URLs de imágenes (se calculan aquí). */
type RawGame = Omit<Game, "coverUrl" | "heroUrl">;

function withImages(game: RawGame): Game {
  const src = game.sources.find((s) => s.platform === "steam") ?? game.sources[0];
  return {
    ...game,
    coverUrl: src ? coverSrc(src.platform, src.externalId, "cover") : "",
    heroUrl: src ? coverSrc(src.platform, src.externalId, "hero") : "",
  };
}

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

/** Biblioteca en caché: instantánea, sin red (RNF7). */
export async function getCachedLibrary(): Promise<Game[]> {
  if (!inTauri) return mock.slice();
  const games = await invoke<RawGame[]>("get_cached_library");
  return games.map(withImages);
}

/** Sincronización en segundo plano (local + Steam Web API). */
export async function syncLibrary(): Promise<SyncResult> {
  if (!inTauri) return { games: mock.slice(), warning: null };
  const result = await invoke<{ games: RawGame[]; warning: string | null }>("sync_library");
  return { games: result.games.map(withImages), warning: result.warning };
}

/** Descripción, género, desarrollador y año. Con datos simulados ya vienen en el juego. */
export async function getGameDetails(game: Game): Promise<GameDetails> {
  if (!inTauri) {
    const { description, genre, developer, protagonist, releaseYear } = game;
    return { description, genre, developer, protagonist, releaseYear };
  }
  return invoke<GameDetails>("get_game_details", { id: game.id });
}

/** Cantidad de juegos detectados para las plataformas indicadas. */
export async function countGamesFor(platforms: Platform[]): Promise<number> {
  const games = await getCachedLibrary();
  return games.filter((g) => g.sources.some((s) => platforms.includes(s.platform))).length;
}

/** RNF7: avisa al backend que la biblioteca ya está visible (registra startup_ms). */
export async function reportStartup(games: number): Promise<number | null> {
  if (!inTauri) return null;
  return invoke<number>("report_startup", { games });
}
