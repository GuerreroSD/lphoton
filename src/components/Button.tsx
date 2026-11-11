import type { ButtonHTMLAttributes, ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { CheckGlyph, DownloadGlyph, PlatformIcon, PlayGlyph, SearchGlyph } from "../assets/icons/icons";
import { PLATFORM_NAMES, type Platform } from "../types";
import styles from "./Button.module.css";

/** Permite mostrar el estado hover de forma estática (página /dev/componentes). */
export type PreviewState = "hover";

type BaseProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  previewState?: PreviewState;
};

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

function previewClass(state?: PreviewState) {
  return state === "hover" ? styles.previewHover : undefined;
}

// ── NavButton ────────────────────────────────────────────────────────
type NavButtonProps = BaseProps & {
  children: ReactNode;
  /** Ruta de destino. Si se indica, se renderiza como enlace y el estado activo es automático. */
  to?: string;
  /** Fuerza el estilo "seleccionado" (pestaña activa). */
  selected?: boolean;
};

export function NavButton({ to, selected, previewState, className, children, ...rest }: NavButtonProps) {
  if (to) {
    return (
      <NavLink
        to={to}
        className={({ isActive }) =>
          cx(styles.base, styles.nav, (isActive || selected) && styles.selected, previewClass(previewState), className)
        }
      >
        {children}
      </NavLink>
    );
  }
  return (
    <button
      type="button"
      aria-current={selected ? "page" : undefined}
      className={cx(styles.base, styles.nav, selected && styles.selected, previewClass(previewState), className)}
      {...rest}
    >
      {children}
    </button>
  );
}

// ── PlayButton (JUGAR) ───────────────────────────────────────────────
export function PlayButton({ previewState, className, children = "Jugar", ...rest }: BaseProps) {
  return (
    <button type="button" className={cx(styles.base, styles.play, previewClass(previewState), className)} {...rest}>
      <PlayGlyph className={styles.icon} />
      <span>{children}</span>
    </button>
  );
}

/** INSTALAR: mismo estilo que JUGAR, para juegos que no están instalados. */
export function InstallButton({ previewState, className, children = "Instalar", ...rest }: BaseProps) {
  return (
    <button type="button" className={cx(styles.base, styles.play, previewClass(previewState), className)} {...rest}>
      <DownloadGlyph className={styles.icon} />
      <span>{children}</span>
    </button>
  );
}

/** Botón principal sin ícono (p. ej. "Iniciar sesión"), con el mismo estilo de JUGAR. */
export function PrimaryButton({ previewState, className, children, type = "button", ...rest }: BaseProps) {
  return (
    <button type={type} className={cx(styles.base, styles.play, previewClass(previewState), className)} {...rest}>
      {children}
    </button>
  );
}

// ── SkipButton (Omitir) ──────────────────────────────────────────────
export function SkipButton({ previewState, className, children = "Omitir", ...rest }: BaseProps) {
  return (
    <button type="button" className={cx(styles.base, styles.skip, previewClass(previewState), className)} {...rest}>
      {children}
    </button>
  );
}

// ── LightModeButton (Activar modo ligero) ────────────────────────────
export function LightModeButton({ previewState, className, children = "Activar modo ligero", ...rest }: BaseProps) {
  return (
    <button type="button" className={cx(styles.base, styles.light, previewClass(previewState), className)} {...rest}>
      {children}
    </button>
  );
}

// ── SearchIcon (lupa) ────────────────────────────────────────────────
type SearchIconProps = BaseProps & { active?: boolean };

export function SearchIcon({ previewState, active, className, ...rest }: SearchIconProps) {
  return (
    <button
      type="button"
      aria-label="Buscar en la biblioteca"
      aria-pressed={active}
      className={cx(styles.base, styles.search, active && styles.selected, previewClass(previewState), className)}
      {...rest}
    >
      <SearchGlyph />
    </button>
  );
}

// ── PlatformLinkButton (vincular cuenta) ─────────────────────────────
type PlatformLinkButtonProps = BaseProps & {
  platform: Platform;
  linked: boolean;
  busy?: boolean;
  /** La integración con esta plataforma aún no existe. */
  unavailable?: boolean;
};

export function PlatformLinkButton({ platform, linked, busy, unavailable, className, ...rest }: PlatformLinkButtonProps) {
  const name = PLATFORM_NAMES[platform];
  return (
    <button
      type="button"
      aria-pressed={linked}
      className={cx(styles.base, styles.platform, linked && styles.selected, className)}
      {...rest}
    >
      <PlatformIcon platform={platform} className={styles.icon} />
      <span>{name}</span>
      <span className={styles.platformState}>
        {unavailable ? "Próximamente" : busy ? "Vinculando…" : linked ? (
          <>
            <CheckGlyph width={12} height={12} style={{ display: "inline", verticalAlign: "-1px" }} /> Vinculada
          </>
        ) : (
          "Vincular"
        )}
      </span>
    </button>
  );
}

// ── TextButton (enlace discreto) ─────────────────────────────────────
export function TextButton({ className, ...rest }: BaseProps) {
  return <button type="button" className={cx(styles.base, styles.text, className)} {...rest} />;
}
