import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./Page.module.css";

export interface PageSection {
  /** id del encabezado (h2) de la sección. */
  id: string;
  label: string;
}

interface SectionPageProps {
  title: string;
  /** Si se indica, en ventanas anchas aparece un índice lateral para saltar entre secciones. */
  sections?: PageSection[];
  children?: ReactNode;
}

/** Estructura compartida por Configuraciones y Perfil. */
export function SectionPage({ title, sections, children }: SectionPageProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(sections?.[0]?.id ?? null);
  // Tras un clic en el índice manda la sección elegida, no la posición del scroll.
  const lockedUntil = useRef(0);

  // Marca en el índice la sección que está a la vista.
  useEffect(() => {
    const root = scroller.current;
    if (!root || !sections?.length) return;
    const onScroll = () => {
      if (Date.now() < lockedUntil.current) return;
      const top = root.getBoundingClientRect().top;
      const atEnd = root.scrollTop > 0 && root.scrollTop + root.clientHeight >= root.scrollHeight - 4;
      let current: string | null = null;
      for (const s of sections) {
        const el = document.getElementById(s.id)?.closest("section");
        if (!el) continue;
        // Las secciones opcionales (p. ej. Steam) pueden no estar en la página.
        if (current === null) current = s.id;
        if (el.getBoundingClientRect().top - top <= 120 || atEnd) current = s.id;
      }
      setActive(current);
    };
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [sections]);

  const goTo = (id: string) => {
    lockedUntil.current = Date.now() + 900;
    setActive(id);
    document.getElementById(id)?.closest("section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className={styles.page} ref={scroller}>
      <div className={styles.layout}>
        {sections && sections.length > 0 && (
          <nav className={styles.index} aria-label={`Secciones de ${title}`}>
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                className={styles.indexItem}
                aria-current={active === s.id ? "true" : undefined}
                onClick={() => goTo(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>
        )}
        <div className={styles.inner}>
          <h1 className={styles.title}>{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}
