import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { checkClientLoad } from "../lib/lightmode";
import { useAppStore } from "../store/appStore";
import { PLATFORM_NAMES, type Platform } from "../types";
import { LightModeButton, SkipButton } from "./Button";
import { Dialog } from "./Dialog";

interface Pending {
  gameId: string;
  platform: Platform;
}

/**
 * Lanzamiento de un juego (RF3), igual desde la portada o desde la ficha: según la
 * preferencia de modo ligero se lanza directo o se pregunta con el diálogo de la
 * maqueta 03. `dialog` debe montarse dentro de un contenedor con position: relative.
 */
export function useLaunchFlow() {
  const navigate = useNavigate();
  const lightModePref = useAppStore((s) => s.lightModePref);
  const [pending, setPending] = useState<Pending | null>(null);
  const [checking, setChecking] = useState(false);

  const launch = useCallback(
    (gameId: string, platform: Platform, lightMode: boolean) => {
      navigate(`/cargando/${gameId}?plataforma=${platform}&ligero=${lightMode ? 1 : 0}`);
    },
    [navigate],
  );

  const play = useCallback(
    async (gameId: string, platform: Platform) => {
      if (lightModePref === "always") return launch(gameId, platform, true);
      if (lightModePref === "never") return launch(gameId, platform, false);
      setChecking(true);
      try {
        const load = await checkClientLoad(platform);
        if (load.high) setPending({ gameId, platform });
        else launch(gameId, platform, false);
      } finally {
        setChecking(false);
      }
    },
    [lightModePref, launch],
  );

  const dismiss = useCallback(() => setPending(null), []);

  const dialog = pending ? (
    <Dialog
      title="¿Optimizar RAM?"
      onDismiss={dismiss}
      actions={
        <>
          <SkipButton onClick={() => launch(pending.gameId, pending.platform, false)} />
          <LightModeButton onClick={() => launch(pending.gameId, pending.platform, true)} />
        </>
      }
    >
      <p>
        LPhoton detectó un alto consumo de recursos de {PLATFORM_NAMES[pending.platform]} en segundo plano. ¿Deseas
        activar el modo ligero para cerrar los procesos innecesarios?
      </p>
    </Dialog>
  ) : null;

  return { play, checking, dialog, dialogOpen: pending !== null };
}
