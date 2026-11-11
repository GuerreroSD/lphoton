import { PlatformIcon } from "../assets/icons/icons";
import { NO_FILTERS, useAppStore } from "../store/appStore";
import { PLATFORM_NAMES, type Platform } from "../types";
import styles from "./LibraryFilters.module.css";

interface LibraryFiltersProps {
  /** Plataformas vinculadas (solo esas se ofrecen como filtro). */
  platforms: Platform[];
  /** Resultados visibles con los filtros actuales. */
  count: number;
}

/** Filtros del panel izquierdo: plataforma, instalados y jugados recientemente (§6.2). */
export function LibraryFilters({ platforms, count }: LibraryFiltersProps) {
  const filters = useAppStore((s) => s.filters);
  const togglePlatformFilter = useAppStore((s) => s.togglePlatformFilter);
  const setFilters = useAppStore((s) => s.setFilters);
  const active = filters.platforms.length > 0 || filters.installedOnly || filters.recentOnly;

  return (
    <div className={styles.filters} role="group" aria-label="Filtros de la biblioteca">
      <div className={styles.row}>
        {platforms.length > 1 &&
          platforms.map((p) => (
            <button
              key={p}
              type="button"
              className={styles.chip}
              aria-pressed={filters.platforms.includes(p)}
              title={`Solo ${PLATFORM_NAMES[p]}`}
              onClick={() => togglePlatformFilter(p)}
            >
              <PlatformIcon platform={p} className={styles.icon} />
              <span>{PLATFORM_NAMES[p]}</span>
            </button>
          ))}
        <button
          type="button"
          className={styles.chip}
          aria-pressed={filters.installedOnly}
          onClick={() => setFilters({ installedOnly: !filters.installedOnly })}
        >
          Instalados
        </button>
        <button
          type="button"
          className={styles.chip}
          aria-pressed={filters.recentOnly}
          title="Jugados en los últimos 30 días"
          onClick={() => setFilters({ recentOnly: !filters.recentOnly })}
        >
          Recientes
        </button>
      </div>
      {active && (
        <p className={styles.summary}>
          {count} {count === 1 ? "juego" : "juegos"} ·{" "}
          <button type="button" className={styles.clear} onClick={() => setFilters(NO_FILTERS)}>
            Quitar filtros
          </button>
        </p>
      )}
    </div>
  );
}
