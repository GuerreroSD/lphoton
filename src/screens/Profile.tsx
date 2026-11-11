import { PlatformBadges } from "../components/PlatformBadge";
import { totalPlaytimeMinutes } from "../lib/library";
import { useAppStore } from "../store/appStore";
import { useLibrary } from "../store/useLibrary";
import { SectionPage } from "./UnderConstruction";
import styles from "./UnderConstruction.module.css";

/** Perfil (§6.7). Estructura básica; se completa en la fase 6. */
export function Profile() {
  const username = useAppStore((s) => s.username);
  const linked = useAppStore((s) => s.linkedPlatforms);
  const { entries } = useLibrary();
  const minutes = entries.reduce((sum, e) => sum + totalPlaytimeMinutes(e.game), 0);

  return (
    <SectionPage title="Perfil" planned="Más adelante podrás editar tu perfil y ver tus estadísticas por plataforma.">
      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt>Usuario</dt>
          <dd>{username ?? "Invitado"}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Plataformas</dt>
          <dd>
            <PlatformBadges platforms={linked} />
          </dd>
        </div>
        <div className={styles.stat}>
          <dt>Juegos</dt>
          <dd>{entries.length}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Horas jugadas</dt>
          <dd>{Math.round(minutes / 60)} h</dd>
        </div>
      </dl>
    </SectionPage>
  );
}
