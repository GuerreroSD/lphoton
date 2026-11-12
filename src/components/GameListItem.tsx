import { memo, useState } from "react";
import { Link } from "react-router-dom";
import { activateGameSoon, cancelActivateGame, useAppStore } from "../store/appStore";
import type { Game, Platform } from "../types";
import styles from "./GameListItem.module.css";
import { PlatformBadges } from "./PlatformBadge";

interface GameListItemProps {
  game: Game;
  /** Plataformas a mostrar (las vinculadas donde el usuario tiene el juego). */
  platforms: Platform[];
}

/**
 * Fila del panel izquierdo: miniatura, nombre e íconos de todas sus plataformas.
 * Pasar el cursor por la fila activa el juego (su arte tiñe el fondo y su portada se enciende).
 * Los juegos sin instalar se ven atenuados, para ubicar rápido los que ya se pueden jugar.
 */
export const GameListItem = memo(function GameListItem({ game, platforms }: GameListItemProps) {
  const active = useAppStore((s) => s.activeGameId === game.id);
  const [failed, setFailed] = useState(!game.coverUrl);
  const installed = game.sources.some((s) => s.installed && platforms.includes(s.platform));
  return (
    <li>
      <Link
        to={`/juego/${game.id}`}
        className={installed ? styles.item : `${styles.item} ${styles.notInstalled}`}
        data-active={active || undefined}
        title={installed ? game.title : `${game.title} (no instalado)`}
        draggable={false}
        onPointerEnter={() => activateGameSoon(game.id)}
        onPointerLeave={cancelActivateGame}
      >
        <span className={styles.thumb} aria-hidden="true">
          {!failed && (
            <img
              src={game.coverUrl}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              width={60}
              height={90}
              onError={() => setFailed(true)}
            />
          )}
        </span>
        <span className={styles.title}>{game.title}</span>
        <PlatformBadges platforms={platforms} />
      </Link>
    </li>
  );
});
