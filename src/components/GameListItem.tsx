import { Link } from "react-router-dom";
import type { Game, Platform } from "../types";
import styles from "./GameListItem.module.css";
import { PlatformBadges } from "./PlatformBadge";

interface GameListItemProps {
  game: Game;
  /** Plataformas a mostrar (las vinculadas donde el usuario tiene el juego). */
  platforms: Platform[];
}

/** Fila del panel izquierdo: nombre + íconos de todas sus plataformas. */
export function GameListItem({ game, platforms }: GameListItemProps) {
  return (
    <li>
      <Link to={`/juego/${game.id}`} className={styles.item}>
        <span className={styles.title}>{game.title}</span>
        <PlatformBadges platforms={platforms} />
      </Link>
    </li>
  );
}
