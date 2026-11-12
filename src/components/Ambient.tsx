import { useEffect, useMemo, useState } from "react";
import { lastPlayedAt } from "../lib/library";
import { useAppStore } from "../store/appStore";
import styles from "./Ambient.module.css";

interface AmbientState {
  /** Dos capas que se turnan: la nueva aparece mientras la anterior se desvanece. */
  urls: [string, string];
  /** Capa visible, o -1 si el juego activo no tiene arte (quedan solo las luces de la marca). */
  front: number;
}

/**
 * Fondo de la app: el arte del juego activo, muy desenfocado, detrás de los paneles.
 * El desenfoque se calcula una vez por imagen; el cambio entre juegos es un fundido
 * de opacidad, que no vuelve a pintar nada.
 */
export function Ambient() {
  const games = useAppStore((s) => s.games);
  const activeGameId = useAppStore((s) => s.activeGameId);
  const loadLibrary = useAppStore((s) => s.loadLibrary);
  // El fondo necesita la biblioteca en cualquier sección (la carga ocurre una sola vez).
  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);
  // Sin juego activo (p. ej. al abrir en otra sección), el más reciente con arte.
  const fallbackUrl = useMemo(() => {
    let best = "";
    let bestAt = -1;
    for (const g of games) {
      const art = g.coverUrl || g.heroUrl;
      const at = lastPlayedAt(g);
      if (art && at > bestAt) {
        best = art;
        bestAt = at;
      }
    }
    return best;
  }, [games]);
  const active = activeGameId ? games.find((g) => g.id === activeGameId) : undefined;
  const url = active ? active.coverUrl || active.heroUrl : fallbackUrl;
  const [state, setState] = useState<AmbientState>({ urls: ["", ""], front: -1 });

  useEffect(() => {
    if (!url) {
      setState((s) => (s.front === -1 ? s : { ...s, front: -1 }));
      return;
    }
    let alive = true;
    const img = new Image();
    // La capa cambia solo cuando la imagen ya está lista: nunca se ve a medio cargar.
    img.onload = () => {
      if (!alive) return;
      setState((s) => {
        if (s.front >= 0 && s.urls[s.front] === url) return s;
        const front = s.front === 0 ? 1 : 0;
        const urls: [string, string] = [s.urls[0], s.urls[1]];
        urls[front] = url;
        return { urls, front };
      });
    };
    img.src = url;
    return () => {
      alive = false;
      img.onload = null;
    };
  }, [url]);

  return (
    <div className={styles.ambient} aria-hidden="true">
      <div className={styles.glow} />
      {state.urls.map((src, i) =>
        src ? (
          <img key={i} className={styles.layer} data-on={state.front === i || undefined} src={src} alt="" decoding="async" />
        ) : null,
      )}
      <div className={styles.veil} />
    </div>
  );
}
