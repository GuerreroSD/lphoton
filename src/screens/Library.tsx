import { useEffect, useRef } from "react";
import { GameCover } from "../components/GameCover";
import { GameListItem } from "../components/GameListItem";
import { useAppStore } from "../store/appStore";
import { matchesQuery, useLibrary } from "../store/useLibrary";
import styles from "./Library.module.css";

/** Biblioteca unificada — maqueta 01. */
export function Library() {
  const { status, alphabetical, recent } = useLibrary();
  const searchOpen = useAppStore((s) => s.searchOpen);
  const query = useAppStore((s) => s.query);
  const setQuery = useAppStore((s) => s.setQuery);
  const closeSearch = useAppStore((s) => s.closeSearch);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const list = alphabetical.filter((e) => matchesQuery(e.game, query));
  const grid = recent.filter((e) => matchesQuery(e.game, query));

  return (
    <div className={styles.library}>
      <aside className={styles.sidebar} aria-label="Lista de juegos">
        <h1 className="visually-hidden">Biblioteca</h1>
        {searchOpen && (
          <div className={styles.search}>
            <label htmlFor="library-search" className="visually-hidden">
              Buscar juego
            </label>
            <input
              id="library-search"
              ref={searchRef}
              className={styles.searchInput}
              type="search"
              placeholder="Buscar juego…"
              value={query}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && closeSearch()}
            />
          </div>
        )}
        <ul className={styles.list}>
          {list.map((e) => (
            <GameListItem key={e.game.id} game={e.game} platforms={e.platforms} />
          ))}
        </ul>
        {status === "ready" && list.length === 0 && <p className={styles.empty}>No hay juegos que coincidan.</p>}
      </aside>

      <section className={styles.content} aria-label="Portadas">
        {status === "loading" && <p className={styles.empty}>Cargando biblioteca…</p>}
        {status === "error" && <p className={styles.empty}>No pudimos cargar tu biblioteca. Intenta de nuevo.</p>}
        <div className={styles.grid}>
          {grid.map((e) => (
            <GameCover key={e.game.id} game={e.game} />
          ))}
        </div>
      </section>
    </div>
  );
}
