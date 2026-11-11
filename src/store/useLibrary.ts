import { useEffect, useMemo } from "react";
import { compareTitles, lastPlayedAt } from "../lib/library";
import type { Game, Platform } from "../types";
import { useAppStore, type LibraryFilters } from "./appStore";

export interface LibraryEntry {
  game: Game;
  /** Plataformas vinculadas donde el usuario tiene el juego (sin duplicados). */
  platforms: Platform[];
}

/**
 * Biblioteca visible: solo juegos de plataformas vinculadas, cada uno una sola vez
 * con todos sus íconos. Carga la biblioteca la primera vez que se usa.
 */
export function useLibrary() {
  const games = useAppStore((s) => s.games);
  const status = useAppStore((s) => s.libraryStatus);
  const linked = useAppStore((s) => s.linkedPlatforms);
  const loadLibrary = useAppStore((s) => s.loadLibrary);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  const entries = useMemo<LibraryEntry[]>(
    () =>
      games
        .map((game) => ({
          game,
          platforms: Array.from(new Set(game.sources.map((s) => s.platform))).filter((p) => linked.includes(p)),
        }))
        .filter((e) => e.platforms.length > 0),
    [games, linked],
  );

  /** Lista alfabética (panel izquierdo). */
  const alphabetical = useMemo(() => entries.slice().sort((a, b) => compareTitles(a.game, b.game)), [entries]);
  /** Grilla: jugados recientemente primero. */
  const recent = useMemo(
    () => entries.slice().sort((a, b) => lastPlayedAt(b.game) - lastPlayedAt(a.game)),
    [entries],
  );

  return { status, entries, alphabetical, recent };
}

/** "Jugados recientemente": última sesión en los últimos 30 días. */
const RECENT_MS = 30 * 24 * 60 * 60 * 1000;

export function matchesFilters(entry: LibraryEntry, filters: LibraryFilters, now = Date.now()): boolean {
  const sources = entry.game.sources.filter((s) => entry.platforms.includes(s.platform));
  if (filters.platforms.length > 0 && !entry.platforms.some((p) => filters.platforms.includes(p))) return false;
  if (filters.installedOnly && !sources.some((s) => s.installed)) return false;
  if (filters.recentOnly && !(now - lastPlayedAt(entry.game) < RECENT_MS)) return false;
  return true;
}

export function matchesQuery(game: Game, query: string): boolean {
  const q = query.trim().toLocaleLowerCase("es");
  if (!q) return true;
  return game.title.toLocaleLowerCase("es").includes(q);
}
