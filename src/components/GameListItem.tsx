import { Link } from "react-router-dom";
import type { Game, Platform } from "../types";
import styles from "./GameListItem.module.css";
import { PlatformBadges } from "./PlatformBadge";

interface GameListItemProps {
  game: Game;
  /** Plataformas a mostrar (las vinculadas donde el usuario tiene el juego). */
  platforms: Platform[];
}

/**
 * Fila del panel izquierdo: nombre + íconos de todas sus plataformas.
 * Los juegos sin instalar se ven atenuados, para ubicar rápido los que ya se pueden jugar.
 */
export function GameListItem({ game, platforms }: GameListItemProps) {
  const installed = game.sources.some((s) => s.installed && platforms.includes(s.platform));
  return (
    <li>
      <Link
        to={`/juego/${game.id}`}
        className={installed ? styles.item : `${styles.item} ${styles.notInstalled}`}
        title={installed ? game.title : `${game.title} (no instalado)`}
      >
        <span className={styles.title}>{game.title}</span>
        <PlatformBadges platforms={platforms} />
      </Link>
    </li>
  );
}
