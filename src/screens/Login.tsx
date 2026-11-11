import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { PlatformLinkButton, PrimaryButton } from "../components/Button";
import { Logo } from "../components/Logo";
import { SteamApiKeyForm } from "../components/SteamApiKeyForm";
import { Toast } from "../components/Toast";
import { isPlatformAvailable, linkPlatform, login, unlinkPlatform } from "../lib/accounts";
import { errorMessage, inTauri } from "../lib/tauri";
import { useAppStore } from "../store/appStore";
import { useLibrary } from "../store/useLibrary";
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
  const [linkError, setLinkError] = useState<string | null>(null);
  // La biblioteca se lee desde la caché/escaneo local; el conteo sale de ahí.
  const { entries, status } = useLibrary();
  const syncing = useAppStore((s) => s.syncing);
  const detected = linked.length > 0 && status === "ready" ? entries.length : null;

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
    setLinkError(null);
    try {
      if (linked.includes(platform)) {
        await unlinkPlatform(platform);
        setPlatformLinked(platform, false);
      } else {
        await linkPlatform(platform);
        setPlatformLinked(platform, true);
      }
    } catch (err) {
      setLinkError(errorMessage(err));
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
                unavailable={!isPlatformAvailable(p)}
                disabled={busy !== null || !isPlatformAvailable(p)}
                onClick={() => togglePlatform(p)}
              />
            ))}
          </div>
          {linkError && <Toast tone="error">{linkError}</Toast>}
          {inTauri && linked.includes("steam") && <SteamApiKeyForm />}
        </section>

        {detected !== null && (
          <div className={styles.result}>
            <Toast tone="success">
              {syncing && detected === 0
                ? "Buscando tus juegos…"
                : `Se han detectado ${detected} ${detected === 1 ? "juego" : "juegos"} en su biblioteca`}
            </Toast>
            <PrimaryButton onClick={() => navigate("/biblioteca")}>Ir a la biblioteca</PrimaryButton>
          </div>
        )}
      </div>
    </main>
  );
}
