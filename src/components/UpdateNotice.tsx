import { useEffect, useState } from "react";
import { checkForUpdate, type AvailableUpdate } from "../lib/updates";
import { errorMessage } from "../lib/tauri";
import styles from "./UpdateNotice.module.css";

/** La búsqueda espera a que la biblioteca ya esté pintada: no afecta el arranque (RNF7). */
const CHECK_DELAY_MS = 6000;

/**
 * Aviso discreto abajo a la derecha cuando hay una versión nueva de LPhoton.
 * Se busca una vez por sesión; "Más tarde" lo oculta hasta el próximo inicio.
 */
export function UpdateNotice() {
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [progress, setProgress] = useState<number | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      checkForUpdate()
        .then((u) => alive && setUpdate(u))
        // Sin conexión o GitHub no responde: se vuelve a intentar en el próximo inicio.
        .catch(() => undefined);
    }, CHECK_DELAY_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  if (!update || dismissed) return null;
  const installing = progress !== undefined;

  const onInstall = async () => {
    setError(null);
    setProgress(null);
    try {
      await update.install(setProgress);
    } catch (err) {
      setProgress(undefined);
      setError(errorMessage(err, "No se pudo instalar la actualización. Intenta más tarde."));
    }
  };

  return (
    <aside className={styles.notice} role="status" aria-label="Actualización disponible">
      <p className={styles.title}>LPhoton {update.version} está disponible</p>
      {error ? (
        <p className={styles.error}>{error}</p>
      ) : installing ? (
        <p className={styles.text}>
          {progress == null ? "Descargando…" : `Descargando… ${Math.round(progress * 100)} %`} LPhoton se reiniciará solo.
        </p>
      ) : (
        <p className={styles.text}>Se descarga e instala en segundos. Tu biblioteca y tu configuración se conservan.</p>
      )}
      {!installing && (
        <div className={styles.actions}>
          <button type="button" className={styles.later} onClick={() => setDismissed(true)}>
            Más tarde
          </button>
          <button type="button" className={styles.install} onClick={() => void onInstall()}>
            Actualizar
          </button>
        </div>
      )}
    </aside>
  );
}
