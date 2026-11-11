import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LightModeButton, PlayButton, SkipButton } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { checkClientLoad } from "../lib/lightmode";
import { getAppMetrics } from "../lib/metrics";
import { useAppStore } from "../store/appStore";
import { useLibrary } from "../store/useLibrary";
import { PLATFORM_NAMES, type AppMetrics, type Platform } from "../types";
import styles from "./GameDetail.module.css";

const METRICS_INTERVAL_MS = 2000;

function useAppMetrics() {
  const [metrics, setMetrics] = useState<AppMetrics | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = () => getAppMetrics().then((m) => alive && setMetrics(m));
    tick();
    const id = setInterval(tick, METRICS_INTERVAL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return metrics;
}

/** Ficha del juego — maqueta 02 (+ diálogo de la maqueta 03). */
export function GameDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { status, entries } = useLibrary();
  const lightModePref = useAppStore((s) => s.lightModePref);
  const metrics = useAppMetrics();
  const [askPlatform, setAskPlatform] = useState<Platform | null>(null);
  const [checking, setChecking] = useState(false);

  const entry = entries.find((e) => e.game.id === id);
  const game = entry?.game;
  // Se lanza desde la tienda donde está instalado; si no, la primera vinculada.
  const source = game?.sources.find((s) => s.installed && entry?.platforms.includes(s.platform)) ??
    game?.sources.find((s) => entry?.platforms.includes(s.platform));
  const platform = source?.platform;

  const launch = useCallback(
    (lightMode: boolean) => {
      if (!game || !platform) return;
      navigate(`/cargando/${game.id}?plataforma=${platform}&ligero=${lightMode ? 1 : 0}`);
    },
    [game, platform, navigate],
  );

  const onPlay = async () => {
    if (!platform) return;
    if (lightModePref === "always") return launch(true);
    if (lightModePref === "never") return launch(false);
    setChecking(true);
    try {
      const load = await checkClientLoad(platform);
      if (load.high) setAskPlatform(platform);
      else launch(false);
    } finally {
      setChecking(false);
    }
  };

  const dismissDialog = useCallback(() => setAskPlatform(null), []);

  if (!game) {
    return (
      <div className={styles.page}>
        <p className={styles.missing}>
          {status === "ready" || status === "error" ? (
            <>
              No encontramos este juego en tu biblioteca. <Link to="/biblioteca">Volver a la biblioteca →</Link>
            </>
          ) : (
            "Cargando…"
          )}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.frame} aria-hidden={askPlatform ? true : undefined}>
        <p className={styles.metrics} aria-label="Consumo de LPhoton">
          CPU: {metrics ? `${metrics.cpuPercent.toFixed(1)}%` : "—"} | RAM: {metrics ? `${metrics.ramMb} MB` : "—"} |
          PLATAFORMA: {platform ? PLATFORM_NAMES[platform].toUpperCase() : "—"}
        </p>
        <article className={styles.card}>
          <img className={styles.hero} src={game.heroUrl} alt="" decoding="async" width={1600} height={620} />
          <div className={styles.info}>
            <PlayButton onClick={onPlay} disabled={!platform || checking} className={styles.play} />
            <div className={styles.text}>
              <h1 className="visually-hidden">{game.title}</h1>
              <p className={styles.description}>{game.description}</p>
            </div>
            <ul className={styles.meta}>
              <li>Género: {game.genre}</li>
              <li>Desarrollador: {game.developer}</li>
              <li>Protagonista: {game.protagonist}</li>
              <li>Año de lanzamiento: {game.releaseYear}</li>
            </ul>
          </div>
        </article>
      </div>

      {askPlatform && (
        <Dialog
          title="¿Optimizar RAM?"
          onDismiss={dismissDialog}
          actions={
            <>
              <SkipButton onClick={() => launch(false)} />
              <LightModeButton onClick={() => launch(true)} />
            </>
          }
        >
          <p>
            LPhoton detectó un alto consumo de recursos de {PLATFORM_NAMES[askPlatform]} en segundo plano. ¿Deseas
            activar el modo ligero para cerrar los procesos innecesarios?
          </p>
        </Dialog>
      )}
    </div>
  );
}
