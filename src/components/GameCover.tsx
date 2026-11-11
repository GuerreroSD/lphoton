import { Link } from "react-router-dom";
import type { Game } from "../types";
import styles from "./GameCover.module.css";

/** Portada vertical 2:3. Borde celeste al pasar el mouse o con foco; clic abre la ficha. */
export function GameCover({ game }: { game: Game }) {
  return (
    <Link to={`/juego/${game.id}`} className={styles.cover} aria-label={game.title} title={game.title}>
      <img src={game.coverUrl} alt="" loading="lazy" decoding="async" width={600} height={900} />
    </Link>
  );
}
