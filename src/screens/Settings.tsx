import { useState } from "react";
import { PlatformLinkButton } from "../components/Button";
import { linkPlatform, unlinkPlatform } from "../lib/accounts";
import { useAppStore } from "../store/appStore";
import type { Platform } from "../types";
import { SectionPage } from "./UnderConstruction";
import styles from "./UnderConstruction.module.css";

const PLATFORMS: Platform[] = ["steam", "epic", "gog"];

/** Configuraciones (§6.7). Estructura básica; el resto llega en la fase 6. */
export function Settings() {
  const linked = useAppStore((s) => s.linkedPlatforms);
  const setPlatformLinked = useAppStore((s) => s.setPlatformLinked);
  const [busy, setBusy] = useState<Platform | null>(null);

  // Siempre debe quedar al menos una plataforma vinculada (si no, se vuelve al Login).
  const toggle = async (p: Platform) => {
    setBusy(p);
    try {
      if (linked.includes(p)) {
        await unlinkPlatform(p);
        setPlatformLinked(p, false);
      } else {
        await linkPlatform(p);
        setPlatformLinked(p, true);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <SectionPage
      title="Configuraciones"
      planned="Pronto podrás elegir el modo ligero (preguntar, siempre o nunca), el modo claro u oscuro y las rutas de instalación."
    >
      <section className={styles.section} aria-labelledby="settings-platforms">
        <h2 id="settings-platforms" className={styles.subtitle}>
          Plataformas vinculadas
        </h2>
        <div className={styles.platformList}>
          {PLATFORMS.map((p) => (
            <PlatformLinkButton
              key={p}
              platform={p}
              linked={linked.includes(p)}
              busy={busy === p}
              disabled={busy !== null || (linked.length === 1 && linked.includes(p))}
              onClick={() => toggle(p)}
            />
          ))}
        </div>
      </section>
    </SectionPage>
  );
}
