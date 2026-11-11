import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./Dialog.module.css";

interface DialogProps {
  title: string;
  children: ReactNode;
  actions: ReactNode;
  /** Escape o clic fuera: cerrar sin elegir. */
  onDismiss: () => void;
}

/**
 * Modal sobre el contenido actual. El fondo se desenfoca con backdrop-filter
 * (la navbar queda nítida, como en la maqueta 03). Debe montarse dentro de
 * un contenedor con position: relative.
 */
export function Dialog({ title, children, actions, onDismiss }: DialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // Ref para no reinstalar el listener (ni mover el foco) si el padre crea un callback nuevo.
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    // Foco inicial en la última acción (la recomendada).
    const buttons = panelRef.current?.querySelectorAll<HTMLButtonElement>("button");
    buttons?.[buttons.length - 1]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        dismissRef.current();
      }
      // Mantener el foco dentro del diálogo.
      if (e.key === "Tab" && buttons && buttons.length > 0) {
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, []);

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onDismiss()}>
      <div ref={panelRef} className={styles.panel} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <div className={styles.body}>{children}</div>
        <div className={styles.actions}>{actions}</div>
      </div>
    </div>
  );
}
