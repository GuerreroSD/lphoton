import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BackGlyph } from "../assets/icons/icons";
import { LightModeButton, PlayButton, SkipButton } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { checkClientLoad } from "../lib/lightmode";
import { getGameDetails } from "../lib/library";
import { getAppMetrics } from "../lib/metrics";
import { errorMessage } from "../lib/tauri";
import { useAppStore } from "../store/appStore";
import { useLibrary } from "../store/useLibrary";
import { PLATFORM_NAMES, type AppMetrics, type Game, type GameDetails, type Platform } from "../types";
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

/** Detalles de la tienda (con caché en el backend). */
function useGameDetails(game: Game | undefined) {
  const [state, setState] = useState<{ id: string; details?: GameDetails; error?: string } | null>(null);
  const gameId = game?.id;
  useEffect(() => {
    if (!game) return;
    let alive = true;
    getGameDetails(game)
      .then((details) => alive && setState({ id: game.id, details }))
      .catch((err) => alive && setState({ id: game.id, error: errorMessage(err) }));
    return () => {
      alive = false;
    };
    // Solo se vuelve a pedir si cambia el juego.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);
  return state?.id === gameId ? state : null;
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
  // Se guarda la URL que falló para no arrastrar el error a otro juego.
  const [failedHero, setFailedHero] = useState<string | null>(null);

  const entry = entries.find((e) => e.game.id === id);
  const game = entry?.game;
  // Se lanza desde la tienda donde está instalado; si no, la primera vinculada.
  const source = game?.sources.find((s) => s.installed && entry?.platforms.includes(s.platform)) ??
    game?.sources.find((s) => entry?.platforms.includes(s.platform));
  const platform = source?.platform;
  const detailsState = useGameDetails(game);
  const details = detailsState?.details;

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

  // Volver a donde estaba el usuario (normalmente la biblioteca, con su búsqueda y filtros).
  const goBack = useCallback(() => {
    const canGoBack = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (canGoBack > 0) navigate(-1);
    else navigate("/biblioteca");
  }, [navigate]);

  // Esc también vuelve, salvo con el diálogo abierto (ahí Esc solo cierra el diálogo).
  useEffect(() => {
    if (askPlatform) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") goBack();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [askPlatform, goBack]);

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
        <div className={styles.topBar}>
          <button type="button" className={styles.back} onClick={goBack} title="Volver (Esc)">
            <BackGlyph className={styles.backIcon} />
            Volver
          </button>
          <p className={styles.metrics} aria-label="Consumo de LPhoton">
            CPU: {metrics ? `${metrics.cpuPercent.toFixed(1)}%` : "—"} | RAM: {metrics ? `${metrics.ramMb} MB` : "—"} |
            PLATAFORMA: {platform ? PLATFORM_NAMES[platform].toUpperCase() : "—"}
          </p>
        </div>
        <article className={styles.card}>
          {failedHero === game.heroUrl || !game.heroUrl ? (
            <div className={styles.heroFallback} aria-hidden="true">
              <span>{game.title}</span>
            </div>
          ) : (
            <img
              className={styles.hero}
              src={game.heroUrl}
              alt=""
              decoding="async"
              width={1600}
              height={620}
              onError={() => setFailedHero(game.heroUrl)}
            />
          )}
          <div className={styles.info}>
            <PlayButton onClick={onPlay} disabled={!platform || checking} className={styles.play} />
            <div className={styles.text}>
              <h1 className="visually-hidden">{game.title}</h1>
              <p className={styles.description}>
                {details?.description ??
                  (detailsState?.error
                    ? `${game.title}. ${detailsState.error}`
                    : detailsState
                      ? game.title
                      : "Cargando información…")}
              </p>
              <Link to={`/foros?juego=${encodeURIComponent(game.id)}`} className={styles.community}>
                Soluciones y mods →
              </Link>
            </div>
            <ul className={styles.meta}>
              {details?.genre && <li>Género: {details.genre}</li>}
              {details?.developer && <li>Desarrollador: {details.developer}</li>}
              {details?.protagonist && <li>Protagonista: {details.protagonist}</li>}
              {details?.releaseYear && <li>Año de lanzamiento: {details.releaseYear}</li>}
              {source && <li>Tiempo jugado: {formatPlaytime(source.playtimeMinutes)}</li>}
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

function formatPlaytime(minutes: number): string {
  if (minutes <= 0) return "sin registrar";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.round(minutes / 60).toLocaleString("es")} h`;
}
