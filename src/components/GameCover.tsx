import { memo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ClockGlyph, DownloadGlyph, PlayGlyph } from "../assets/icons/icons";
import { formatPlaytime, launchSource, playtimeMinutesOn } from "../lib/library";
import { activateGameSoon, cancelActivateGame, useAppStore } from "../store/appStore";
import type { Game, Platform } from "../types";
import styles from "./GameCover.module.css";
import { PlatformBadges } from "./PlatformBadge";

interface GameCoverProps {
  game: Game;
  /** Plataformas vinculadas donde el usuario tiene el juego. */
  platforms?: Platform[];
  /** Lanza el juego desde la portada. Sin él, el botón lleva a la ficha. */
  onPlay?: (game: Game, platform: Platform) => void;
}

/**
 * Portada vertical 2:3. Bajo el cursor (o con el foco) crece un poco y muestra el
 * nombre, el tiempo jugado, sus tiendas y el botón JUGAR. La portada del juego
 * activo lleva el borde de neón del logo. Los juegos sin instalar se ven atenuados.
 */
export const GameCover = memo(function GameCover({ game, platforms = [], onPlay }: GameCoverProps) {
  const navigate = useNavigate();
  const active = useAppStore((s) => s.activeGameId === game.id);
  const setActiveGame = useAppStore((s) => s.setActiveGame);
  const [failed, setFailed] = useState(!game.coverUrl);

  const owned = platforms.length > 0 ? platforms : game.sources.map((s) => s.platform);
  const source = launchSource(game, owned);
  const installed = !!source?.installed;
  const minutes = playtimeMinutesOn(game, owned);
  const label = installed ? game.title : `${game.title} (no instalado)`;

  const onAction = () => {
    if (installed && source && onPlay) onPlay(game, source.platform);
    else navigate(`/juego/${game.id}`);
  };

  return (
    <div
      className={installed ? styles.cover : `${styles.cover} ${styles.notInstalled}`}
      data-active={active || undefined}
      onPointerEnter={() => activateGameSoon(game.id)}
      onPointerLeave={cancelActivateGame}
      onFocus={() => setActiveGame(game.id)}
    >
      <Link to={`/juego/${game.id}`} className={styles.art} aria-label={label} draggable={false}>
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
            draggable={false}
            width={600}
            height={900}
            onError={() => setFailed(true)}
          />
        )}
      </Link>
      {!installed && (
        <span className={styles.badge} title="No instalado" aria-hidden="true">
          <DownloadGlyph className={styles.badgeIcon} />
        </span>
      )}
      <div className={styles.overlay}>
        {!failed && (
          <span className={styles.title} aria-hidden="true">
            {game.title}
          </span>
        )}
        <span className={styles.meta} aria-hidden="true">
          <span className={styles.playtime} title="Tiempo jugado">
            <ClockGlyph className={styles.metaIcon} />
            {minutes > 0 ? formatPlaytime(minutes) : "Sin jugar"}
          </span>
          <PlatformBadges platforms={platforms} />
        </span>
        {/* Fuera del orden de tabulación: con teclado se juega desde la ficha (Enter en la portada). */}
        <button
          type="button"
          className={styles.action}
          tabIndex={-1}
          aria-label={installed ? `Jugar ${game.title}` : `Instalar ${game.title}`}
          onClick={onAction}
        >
          {installed ? <PlayGlyph className={styles.actionIcon} /> : <DownloadGlyph className={styles.actionIcon} />}
          {installed ? "Jugar" : "Instalar"}
        </button>
      </div>
    </div>
  );
});
