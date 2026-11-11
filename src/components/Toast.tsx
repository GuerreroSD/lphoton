import type { ReactNode } from "react";
import styles from "./Toast.module.css";

interface ToastProps {
  tone: "success" | "error" | "info";
  children: ReactNode;
}

/**
 * Mensaje de estado en línea (no es un pop-up: aparece donde ocurre la acción).
 * Tono claro y directo, como pide la guía de estilos.
 */
export function Toast({ tone, children }: ToastProps) {
  return (
    <div className={`${styles.toast} ${styles[tone]}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}
