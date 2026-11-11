import styles from "./Logo.module.css";

type LogoSize = "nav" | "lg" | "display";

interface LogoProps {
  size?: LogoSize;
  /** Muestra el logo dentro de la caja oscura redondeada (navbar). */
  boxed?: boolean;
  /** Versión para fondo claro: el degradado parte en Morado (§5.3). */
  onLight?: boolean;
  className?: string;
}

/** Logo "LPhoton" en Faster One. No se estira, rota ni cambia de fuente. */
export function Logo({ size = "nav", boxed = false, onLight = false, className }: LogoProps) {
  const text = (
    <span className={[styles.logo, styles[size], onLight && styles.onLight].filter(Boolean).join(" ")} aria-label="LPhoton">
      LPhoton
    </span>
  );
  if (!boxed) return <span className={className}>{text}</span>;
  return (
    <span className={[styles.box, size !== "nav" && styles.boxLg, className].filter(Boolean).join(" ")}>{text}</span>
  );
}
