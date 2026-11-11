import styles from "./ProgressBar.module.css";

interface ProgressBarProps {
  /** 0..1 */
  value: number;
  label: string;
}

/** Relleno celeste sobre pista lavanda. Se anima con transform: scaleX (barato). */
export function ProgressBar({ value, label }: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <div
      className={styles.track}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      <div className={styles.fill} style={{ transform: `scaleX(${clamped})` }} />
    </div>
  );
}
