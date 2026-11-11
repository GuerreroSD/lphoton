import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PlatformIcon } from "../assets/icons/icons";
import { TextButton } from "../components/Button";
import { Logo } from "../components/Logo";
import { ProgressBar } from "../components/ProgressBar";
import { LAUNCH_STEP_LABELS, launchGame } from "../lib/launcher";
import { useLibrary } from "../store/useLibrary";
import { PLATFORM_NAMES, type LaunchProgress, type Platform } from "../types";
import styles from "./LaunchScreen.module.css";

const PLATFORMS: Platform[] = ["steam", "epic", "gog"];

/** Pantalla de carga "Iniciando juego optimizado" — maqueta 04. */
export function LaunchScreen() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { entries } = useLibrary();
  const game = entries.find((e) => e.game.id === id)?.game;

  const requested = params.get("plataforma") as Platform | null;
  const platform: Platform = requested && PLATFORMS.includes(requested) ? requested : "steam";
  const lightMode = params.get("ligero") === "1";

  const [progress, setProgress] = useState<LaunchProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ kind: "playing" | "handoff"; message: string | null } | null>(null);
  const [lightDetail, setLightDetail] = useState<string | null>(null);
  const done = outcome !== null;
  const lightApplied = lightMode && lightDetail !== null;

  const externalId = game?.sources.find((s) => s.platform === platform)?.externalId;
  const title = game?.title ?? "";

  useEffect(() => {
    if (!externalId) return;
    setProgress(null);
    setError(null);
    setOutcome(null);
    setLightDetail(null);
    return launchGame(
      { gameId: id, title, platform, externalId, lightMode },
      {
        onProgress: (p) => {
          setProgress(p);
          if (p.step === "light-mode-applied") setLightDetail(p.detail ?? "Procesos en segundo plano suspendidos");
        },
        onDone: (kind, message) => {
          setOutcome({ kind, message });
          setProgress((p) => ({ step: p?.step ?? "game-detected", progress: 1, detail: p?.detail }));
        },
        onError: setError,
      },
    );
  }, [id, title, platform, externalId, lightMode]);

  // Al abrirse el juego, LPhoton pasa a la bandeja (la ventana se cierra sola). Esc vuelve a la ficha.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && navigate(`/juego/${id}`);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [id, navigate]);

  const platformName = PLATFORM_NAMES[platform];

  return (
    <main className={styles.screen}>
      <p className={`${styles.corner} ${styles.topLeft}`}>FPS: Optimizados</p>
      {lightMode && <p className={`${styles.corner} ${styles.topRight}`}>Modo ligero activo</p>}

      <div className={styles.center}>
        <h1 className={styles.logo}>
          <Logo size="lg" />
        </h1>
        <p className={styles.status} role={error ? "alert" : undefined}>
          {error ??
            (outcome?.kind === "handoff"
              ? outcome.message
              : done
                ? "juego iniciado · LPhoton pasará a la bandeja"
                : "inicializando juego")}
        </p>
        <div className={styles.bar}>
          <ProgressBar value={progress?.progress ?? 0.04} label="Progreso de inicio del juego" />
        </div>
        <p className="visually-hidden" aria-live="polite">
          {progress ? LAUNCH_STEP_LABELS[progress.step] : "Iniciando cliente"}
        </p>
        <div className={styles.after} style={{ opacity: done || error ? 1 : 0 }} aria-hidden={!done && !error}>
          <TextButton onClick={() => navigate(error ? `/juego/${id}` : "/biblioteca")} tabIndex={done || error ? 0 : -1}>
            {error ? "Volver a la ficha" : "Volver a la biblioteca"}
          </TextButton>
        </div>
      </div>

      <div className={styles.gameCard}>
        {game && <img className={styles.thumb} src={game.coverUrl} alt="" width={44} height={44} />}
        <div className={styles.gameText}>
          <p className={styles.gameName}>{game?.title ?? "Juego"}</p>
          <p className={styles.gameFrom}>
            Iniciando desde {platformName}
            <span className={styles.platformChip}>
              <PlatformIcon platform={platform} />
            </span>
          </p>
        </div>
      </div>

      {lightMode && (
        <div className={styles.lightCard} style={{ opacity: lightApplied ? 1 : 0.55 }}>
          <p className={styles.lightTitle}>{lightApplied ? "Modo ligero activado" : "Activando modo ligero…"}</p>
          <p className={styles.lightText}>{lightDetail ?? "Procesos en segundo plano suspendidos"}</p>
        </div>
      )}
    </main>
  );
}
