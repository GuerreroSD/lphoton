import { useState } from "react";
import { Link } from "react-router-dom";
import { DownloadGlyph } from "../assets/icons/icons";
import type { Game, Platform } from "../types";
import styles from "./GameCover.module.css";
import { PlatformBadges } from "./PlatformBadge";

interface GameCoverProps {
  game: Game;
  /** Plataformas vinculadas donde el usuario tiene el juego. */
  platforms?: Platform[];
}

/**
 * Portada vertical 2:3. Con el mouse o el foco lleva borde celeste y muestra una
 * franja con el nombre y sus tiendas. Los juegos sin instalar llevan una marca.
 */
export function GameCover({ game, platforms = [] }: GameCoverProps) {
  const [failed, setFailed] = useState(!game.coverUrl);
  const installed = game.sources.some((s) => s.installed && (platforms.length === 0 || platforms.includes(s.platform)));
  const label = installed ? game.title : `${game.title} (no instalado)`;
  return (
    <Link to={`/juego/${game.id}`} className={styles.cover} aria-label={label}>
      {failed ? (
        // Sin portada (juego sin arte en el CDN o sin conexión): placeholder liviano con el título.
        <span className={styles.fallback} aria-hidden="true">
          <span className={styles.fallbackBar} />
          <span className={styles.fallbackTitle}>{game.title}</span>
        </span>
      ) : (
        <img
          src={game.coverUrl}
          alt=""
          loading="lazy"
          decoding="async"
          width={600}
          height={900}
          onError={() => setFailed(true)}
        />
      )}
      {!installed && (
        <span className={styles.notInstalled} title="No instalado" aria-hidden="true">
          <DownloadGlyph className={styles.notInstalledIcon} />
        </span>
      )}
      <span className={styles.caption} aria-hidden="true">
        {!failed && <span className={styles.captionTitle}>{game.title}</span>}
        <span className={styles.captionMeta}>
          <PlatformBadges platforms={platforms} />
          {!installed && <span className={styles.captionState}>Sin instalar</span>}
        </span>
      </span>
    </Link>
  );
}
