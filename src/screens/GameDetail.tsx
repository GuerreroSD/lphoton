import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BackGlyph } from "../assets/icons/icons";
import { InstallButton, PlayButton } from "../components/Button";
import { useLaunchFlow } from "../components/LaunchFlow";
import { PlatformBadges } from "../components/PlatformBadge";
import { ProgressBar } from "../components/ProgressBar";
import { formatBytes, getInstallStatus, installGame, type InstallStatus } from "../lib/install";
import { formatPlaytime, getGameDetails } from "../lib/library";
import { getAppMetrics } from "../lib/metrics";
import { errorMessage } from "../lib/tauri";
import { useAppStore } from "../store/appStore";
import { useLibrary } from "../store/useLibrary";
import { PLATFORM_NAMES, type AppMetrics, type Game, type GameDetails, type GameSource, type Platform } from "../types";
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

const INSTALL_POLL_MS = 2000;
const FOCUS_REFRESH_MS = 30_000;

/**
 * Instalación desde la ficha. Steam: se sigue la descarga leyendo su appmanifest
 * y, al terminar, se vuelve a sincronizar la biblioteca (JUGAR aparece solo).
 * Epic y GOG no exponen el progreso: se re-sincroniza al volver a LPhoton.
 */
function useInstall(source: GameSource | undefined, needsInstall: boolean) {
  const refreshLibrary = useAppStore((s) => s.refreshLibrary);
  const [requested, setRequested] = useState(false);
  const [status, setStatus] = useState<InstallStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isSteam = source?.platform === "steam";
  const externalId = source?.externalId;

  // Steam: se consulta al abrir la ficha (puede haber una descarga en curso) y
  // cada 2 s mientras haya una descarga pedida o en curso.
  useEffect(() => {
    if (!needsInstall || !isSteam || !externalId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      const next = await getInstallStatus(externalId).catch(() => null);
      if (!alive) return;
      setStatus(next);
      if (next?.state === "installed") {
        void refreshLibrary();
        return;
      }
      if (requested || (next && next.state !== "none")) timer = setTimeout(tick, INSTALL_POLL_MS);
    };
    void tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [needsInstall, isSteam, externalId, requested, refreshLibrary]);

  // Epic y GOG: al volver a la ventana se revisa si ya se instaló.
  useEffect(() => {
    if (!needsInstall || isSteam || !requested) return;
    let last = 0;
    const onFocus = () => {
      if (Date.now() - last < FOCUS_REFRESH_MS) return;
      last = Date.now();
      void refreshLibrary();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [needsInstall, isSteam, requested, refreshLibrary]);

  const install = async () => {
    if (!source) return;
    setError(null);
    try {
      await installGame(source);
      setRequested(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return { install, requested, status, error };
}

function InstallInfo({
  platform,
  requested,
  status,
  error,
}: {
  platform: Platform;
  requested: boolean;
  status: InstallStatus | null;
  error: string | null;
}) {
  const name = PLATFORM_NAMES[platform];
  if (error) return <p className={styles.installError} role="alert">{error}</p>;
  if (status?.state === "downloading") {
    const value = status.totalBytes > 0 ? status.downloadedBytes / status.totalBytes : 0;
    return (
      <div className={styles.install}>
        <p className={styles.installText}>
          Descargando en {name}: {Math.floor(value * 100)} % · {formatBytes(status.downloadedBytes)} de{" "}
          {formatBytes(status.totalBytes)}
        </p>
        <ProgressBar value={value} label="Progreso de la descarga" />
      </div>
    );
  }
  if (status?.state === "queued") {
    return <p className={styles.installText}>En cola en {name}. La descarga empezará en breve.</p>;
  }
  if (status?.state === "installed") {
    return <p className={styles.installText}>¡Listo! Actualizando tu biblioteca…</p>;
  }
  if (requested) {
    return (
      <p className={styles.installText}>
        {platform === "steam"
          ? "Se abrió Steam: elige la carpeta y confirma en su ventana. El progreso aparecerá aquí."
          : `Se abrió ${name}: confirma la instalación allí. Cuando termine, el juego aparecerá como instalado.`}
      </p>
    );
  }
  return <p className={styles.installText}>No está instalado. Se instalará con {name}.</p>;
}

/** Ficha del juego: banner con el título, acción principal y datos sobre un panel de vidrio. */
export function GameDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { status, entries } = useLibrary();
  const setActiveGame = useAppStore((s) => s.setActiveGame);
  const metrics = useAppMetrics();
  const { play, checking, dialog, dialogOpen } = useLaunchFlow();
  // Se guarda la URL que falló para no arrastrar el error a otro juego.
  const [failedHero, setFailedHero] = useState<string | null>(null);

  const entry = entries.find((e) => e.game.id === id);
  const game = entry?.game;
  // Se lanza desde la tienda donde está instalado; si no, la primera vinculada.
  const source = game?.sources.find((s) => s.installed && entry?.platforms.includes(s.platform)) ??
    game?.sources.find((s) => entry?.platforms.includes(s.platform));
  const platform = source?.platform;
  const needsInstall = !!source && !source.installed;
  const installer = useInstall(source, needsInstall);
  const detailsState = useGameDetails(game);
  const details = detailsState?.details;

  // El fondo de la app toma el arte de este juego.
  const gameId = game?.id;
  useEffect(() => {
    if (gameId) setActiveGame(gameId);
  }, [gameId, setActiveGame]);

  const onPlay = () => {
    if (game && platform) void play(game.id, platform);
  };

  // Volver a donde estaba el usuario (normalmente la biblioteca, con su búsqueda y filtros).
  const goBack = useCallback(() => {
    const canGoBack = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (canGoBack > 0) navigate(-1);
    else navigate("/biblioteca");
  }, [navigate]);

  // Esc también vuelve, salvo con el diálogo abierto (ahí Esc solo cierra el diálogo).
  useEffect(() => {
    if (dialogOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") goBack();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dialogOpen, goBack]);

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
      <div className={styles.frame} aria-hidden={dialogOpen ? true : undefined}>
        <div className={styles.topBar}>
          <button type="button" className={styles.back} onClick={goBack} title="Volver (Esc)">
            <BackGlyph className={styles.backIcon} />
            Volver
          </button>
          <p className={styles.metrics} aria-label="Consumo de LPhoton">
            <span>
              CPU <b>{metrics ? `${metrics.cpuPercent.toFixed(1)}%` : "—"}</b>
            </span>
            <span>
              RAM <b>{metrics ? `${metrics.ramMb} MB` : "—"}</b>
            </span>
            <span>
              Plataforma <b>{platform ? PLATFORM_NAMES[platform] : "—"}</b>
            </span>
          </p>
        </div>
        <article className={styles.card}>
          <div className={styles.banner}>
            {failedHero === game.heroUrl || !game.heroUrl ? (
              <div className={styles.heroFallback} aria-hidden="true" />
            ) : (
              <img
                className={styles.hero}
                src={game.heroUrl}
                alt=""
                decoding="async"
                draggable={false}
                width={1600}
                height={620}
                onError={() => setFailedHero(game.heroUrl)}
              />
            )}
            <div className={styles.heading}>
              <PlatformBadges platforms={entry?.platforms ?? []} />
              <h1 className={styles.title}>{game.title}</h1>
            </div>
          </div>
          <div className={styles.info}>
            {needsInstall ? (
              <InstallButton
                onClick={() => void installer.install()}
                disabled={installer.status?.state === "downloading" || installer.status?.state === "queued"}
                className={styles.play}
              >
                {installer.status?.state === "downloading" ? "Descargando" : "Instalar"}
              </InstallButton>
            ) : (
              <PlayButton onClick={onPlay} disabled={!platform || checking} className={styles.play} />
            )}
            <div className={styles.text}>
              {needsInstall && platform && (
                <InstallInfo
                  platform={platform}
                  requested={installer.requested}
                  status={installer.status}
                  error={installer.error}
                />
              )}
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
            <dl className={styles.meta}>
              {source && <Fact label="Tiempo jugado" value={formatPlaytime(source.playtimeMinutes)} />}
              {details?.genre && <Fact label="Género" value={details.genre} />}
              {details?.developer && <Fact label="Desarrollador" value={details.developer} />}
              {details?.protagonist && <Fact label="Protagonista" value={details.protagonist} />}
              {details?.releaseYear && <Fact label="Lanzamiento" value={details.releaseYear} />}
            </dl>
          </div>
        </article>
      </div>

      {dialog}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
