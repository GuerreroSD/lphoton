import { PlatformIcon } from "../assets/icons/icons";
import { PLATFORM_NAMES, type Platform } from "../types";
import styles from "./PlatformBadge.module.css";

interface PlatformBadgeProps {
  platform: Platform;
  /** Muestra el nombre junto al ícono (p. ej. "STEAM"). */
  withLabel?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/** Ícono pequeño de Steam / Epic / GOG junto al nombre de un juego. */
export function PlatformBadge({ platform, withLabel = false, size = "sm", className }: PlatformBadgeProps) {
  const name = PLATFORM_NAMES[platform];
  return (
    <span
      className={[styles.badge, styles[size], className].filter(Boolean).join(" ")}
      title={name}
      role="img"
      aria-label={withLabel ? undefined : name}
    >
      <span className={styles.chip}>
        <PlatformIcon platform={platform} className={styles.icon} />
      </span>
      {withLabel && <span className={styles.label}>{name}</span>}
    </span>
  );
}

export function PlatformBadges({ platforms, className }: { platforms: Platform[]; className?: string }) {
  return (
    <span className={[styles.group, className].filter(Boolean).join(" ")}>
      {platforms.map((p) => (
        <PlatformBadge key={p} platform={p} />
      ))}
    </span>
  );
}
