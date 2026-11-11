import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { PlatformLinkButton, PrimaryButton } from "../components/Button";
import { Logo } from "../components/Logo";
import { Toast } from "../components/Toast";
import { linkPlatform, login, unlinkPlatform } from "../lib/accounts";
import { countGamesFor } from "../lib/library";
import { useAppStore } from "../store/appStore";
import type { Platform } from "../types";
import styles from "./Login.module.css";

const PLATFORMS: Platform[] = ["steam", "epic", "gog"];

/** Vinculación inicial / Login (§6.1, prototipo en papel). */
export function Login() {
  const navigate = useNavigate();
  const username = useAppStore((s) => s.username);
  const setUsername = useAppStore((s) => s.setUsername);
  const linked = useAppStore((s) => s.linkedPlatforms);
  const setPlatformLinked = useAppStore((s) => s.setPlatformLinked);

  const [user, setUser] = useState(username ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busy, setBusy] = useState<Platform | null>(null);
  const [detected, setDetected] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    if (linked.length === 0) setDetected(null);
    else countGamesFor(linked).then((n) => alive && setDetected(n));
    return () => {
      alive = false;
    };
  }, [linked]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const session = await login(user, password);
      setUsername(session.username);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos iniciar sesión. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const togglePlatform = async (platform: Platform) => {
    setBusy(platform);
    try {
      if (linked.includes(platform)) {
        await unlinkPlatform(platform);
        setPlatformLinked(platform, false);
      } else {
        await linkPlatform(platform);
        setPlatformLinked(platform, true);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className={styles.screen}>
      <div className={styles.card}>
        <h1 className={styles.logo}>
          <Logo size="lg" />
        </h1>

        {username ? (
          <p className={styles.welcome}>Hola, {username}. Vincula tus plataformas para armar tu biblioteca.</p>
        ) : (
          <form className={styles.form} onSubmit={onSubmit} noValidate>
            <h2 className={styles.heading}>Iniciar sesión</h2>
            <label className={styles.field}>
              <span className={styles.label}>Usuario</span>
              <input
                className={styles.input}
                value={user}
                onChange={(e) => setUser(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Contraseña</span>
              <input
                className={styles.input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            {error && <Toast tone="error">{error}</Toast>}
            <PrimaryButton type="submit" disabled={submitting} className={styles.submit}>
              {submitting ? "Ingresando…" : "Iniciar sesión"}
            </PrimaryButton>
          </form>
        )}

        <section className={styles.platforms} aria-labelledby="link-heading">
          <h2 id="link-heading" className={styles.heading}>
            Vincular plataformas
          </h2>
          <div className={styles.platformList}>
            {PLATFORMS.map((p) => (
              <PlatformLinkButton
                key={p}
                platform={p}
                linked={linked.includes(p)}
                busy={busy === p}
                disabled={busy !== null}
                onClick={() => togglePlatform(p)}
              />
            ))}
          </div>
        </section>

        {detected !== null && (
          <div className={styles.result}>
            <Toast tone="success">
              Se han detectado {detected} {detected === 1 ? "juego" : "juegos"} en su biblioteca
            </Toast>
            <PrimaryButton onClick={() => navigate("/biblioteca")}>Ir a la biblioteca</PrimaryButton>
          </div>
        )}
      </div>
    </main>
  );
}
