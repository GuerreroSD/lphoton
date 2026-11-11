import type { ReactNode } from "react";
import { Toast } from "../components/Toast";
import styles from "./UnderConstruction.module.css";

interface SectionPageProps {
  title: string;
  /** Qué incluirá la sección cuando esté lista. */
  planned: string;
  children?: ReactNode;
}

/** Estructura básica compartida por Foros, Configuraciones y Perfil (fase 1). */
export function SectionPage({ title, planned, children }: SectionPageProps) {
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.title}>{title}</h1>
        <Toast tone="info">
          Sección en construcción. {planned}
        </Toast>
        {children}
      </div>
    </div>
  );
}
