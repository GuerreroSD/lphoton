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
  const done = progress?.progress === 1;
  const lightApplied = lightMode && progress?.step === "light-mode-applied";

  useEffect(() => {
    setProgress(null);
    return launchGame({ gameId: id, platform, lightMode }, setProgress);
  }, [id, platform, lightMode]);

  // Fase 4: al tomar foco el juego, LPhoton se minimiza a la bandeja. Aquí, Esc vuelve a la ficha.
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
        <p className={styles.status}>{done ? "juego iniciado" : "inicializando juego"}</p>
        <div className={styles.bar}>
          <ProgressBar value={progress?.progress ?? 0.04} label="Progreso de inicio del juego" />
        </div>
        <p className="visually-hidden" aria-live="polite">
          {progress ? LAUNCH_STEP_LABELS[progress.step] : "Iniciando cliente"}
        </p>
        <div className={styles.after} style={{ opacity: done ? 1 : 0 }} aria-hidden={!done}>
          <TextButton onClick={() => navigate("/biblioteca")} tabIndex={done ? 0 : -1}>
            Volver a la biblioteca
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
          <p className={styles.lightText}>Procesos en segundo plano suspendidos</p>
        </div>
      )}
    </main>
  );
}
