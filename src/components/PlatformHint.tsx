import { useEffect, useMemo, useState } from "react";
import { getPlatformsStatus, linkPlatform, type PlatformsStatus } from "../lib/accounts";
import { errorMessage } from "../lib/tauri";
import { useAppStore } from "../store/appStore";
import { PLATFORM_NAMES, type Platform } from "../types";
import styles from "./PlatformHint.module.css";

const PLATFORMS: Platform[] = ["steam", "epic", "gog"];

/**
 * Aviso discreto en la biblioteca: hay una plataforma instalada con juegos que
 * el usuario aún no vinculó. Se vincula con un clic o se descarta para siempre.
 */
export function PlatformHint() {
  const games = useAppStore((s) => s.games);
  const linked = useAppStore((s) => s.linkedPlatforms);
  const dismissed = useAppStore((s) => s.dismissedPlatformHints);
  const setPlatformLinked = useAppStore((s) => s.setPlatformLinked);
  const dismissPlatformHint = useAppStore((s) => s.dismissPlatformHint);
  const [status, setStatus] = useState<PlatformsStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getPlatformsStatus()
      .then((s) => alive && setStatus(s))
      .catch(() => alive && setStatus(null));
    return () => {
      alive = false;
    };
  }, []);

  // Primera plataforma detectada, no vinculada, no descartada y con juegos.
  const suggestion = useMemo(() => {
    if (!status) return null;
    for (const platform of PLATFORMS) {
      if (!status[platform] || linked.includes(platform) || dismissed.includes(platform)) continue;
      const count = games.filter((g) => g.sources.some((s) => s.platform === platform)).length;
      if (count > 0) return { platform, count };
    }
    return null;
  }, [status, games, linked, dismissed]);

  if (!suggestion) return null;
  const { platform, count } = suggestion;
  const name = PLATFORM_NAMES[platform];

  const onLink = async () => {
    setBusy(true);
    setError(null);
    try {
      await linkPlatform(platform);
      setPlatformLinked(platform, true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.hint} role="status">
      <p className={styles.text}>
        Encontramos {count} {count === 1 ? "juego" : "juegos"} de {name} en este equipo.
      </p>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.actions}>
        <button type="button" className={styles.link} onClick={onLink} disabled={busy}>
          {busy ? "Vinculando…" : `Vincular ${name} →`}
        </button>
        <button type="button" className={styles.dismiss} onClick={() => dismissPlatformHint(platform)} disabled={busy}>
          Ahora no
        </button>
      </div>
    </div>
  );
}
