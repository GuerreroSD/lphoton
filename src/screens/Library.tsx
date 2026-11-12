import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { TextButton } from "../components/Button";
import { GameCover } from "../components/GameCover";
import { GameListItem } from "../components/GameListItem";
import { LibraryFilters } from "../components/LibraryFilters";
import { PlatformHint } from "../components/PlatformHint";
import { Toast } from "../components/Toast";
import { reportStartup } from "../lib/library";
import { NO_FILTERS, useAppStore } from "../store/appStore";
import { matchesFilters, matchesQuery, useLibrary } from "../store/useLibrary";
import styles from "./Library.module.css";

// RNF7: se mide una sola vez, en el primer pintado con la biblioteca visible.
let startupReported = false;

/** Biblioteca unificada — maqueta 01. */
export function Library() {
  const { status, alphabetical, recent } = useLibrary();
  const searchOpen = useAppStore((s) => s.searchOpen);
  const query = useAppStore((s) => s.query);
  const setQuery = useAppStore((s) => s.setQuery);
  const closeSearch = useAppStore((s) => s.closeSearch);
  const syncing = useAppStore((s) => s.syncing);
  const syncWarning = useAppStore((s) => s.syncWarning);
  const filters = useAppStore((s) => s.filters);
  const setFilters = useAppStore((s) => s.setFilters);
  const linked = useAppStore((s) => s.linkedPlatforms);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (startupReported || status !== "ready") return;
    startupReported = true;
    const count = alphabetical.length;
    requestAnimationFrame(() => {
      void reportStartup(count).then((ms) => ms !== null && console.info(`[LPhoton] startup_ms=${ms}`));
    });
  }, [status, alphabetical.length]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const visible = (e: (typeof alphabetical)[number]) => matchesQuery(e.game, query) && matchesFilters(e, filters);
  const list = alphabetical.filter(visible);
  const grid = recent.filter(visible);

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
        <PlatformHint />
        <LibraryFilters platforms={linked} count={list.length} />
        <ul className={styles.list}>
          {list.map((e) => (
            <GameListItem key={e.game.id} game={e.game} platforms={e.platforms} />
          ))}
        </ul>
        <div className={styles.status}>
          {syncing && <p className={styles.syncing}>Sincronizando…</p>}
          {syncWarning && !syncing && (
            <Toast tone="error">
              {syncWarning} <Link to="/configuraciones">Revisa la solución aquí →</Link>
            </Toast>
          )}
        </div>
      </aside>

      <section className={styles.content} aria-label="Portadas">
        {status === "error" && <p className={styles.empty}>No pudimos cargar tu biblioteca. Intenta de nuevo.</p>}
        {(status === "loading" || status === "idle") && (
          // Silueta de la grilla mientras se lee la caché: evita el salto al pintar las portadas.
          <div className={styles.grid} aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className={styles.skeleton} />
            ))}
          </div>
        )}
        {status === "ready" && grid.length === 0 && (
          <div className={styles.blank} role="status">
            {alphabetical.length === 0 ? (
              <>
                <h2 className={styles.blankTitle}>{syncing ? "Buscando tus juegos…" : "Tu biblioteca está vacía"}</h2>
                {!syncing && (
                  <p className={styles.blankText}>
                    No encontramos juegos en tus plataformas vinculadas.{" "}
                    <Link to="/configuraciones">Revisar plataformas →</Link>
                  </p>
                )}
              </>
            ) : (
              <>
                <h2 className={styles.blankTitle}>Ningún juego coincide</h2>
                <p className={styles.blankText}>
                  {query.trim() ? `No hay resultados para “${query.trim()}”` : "No hay juegos con estos filtros"}.
                </p>
                <TextButton
                  onClick={() => {
                    setFilters(NO_FILTERS);
                    setQuery("");
                  }}
                >
                  Ver toda la biblioteca
                </TextButton>
              </>
            )}
          </div>
        )}
        <div className={styles.grid}>
          {grid.map((e) => (
            <GameCover key={e.game.id} game={e.game} platforms={e.platforms} />
          ))}
        </div>
      </section>
    </div>
  );
}
