import type { ReactNode } from "react";
import styles from "./Page.module.css";

/** Estructura compartida por Configuraciones y Perfil. */
export function SectionPage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.title}>{title}</h1>
        {children}
      </div>
    </div>
  );
}
