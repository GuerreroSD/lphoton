import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { PlatformIcon } from "../assets/icons/icons";
import { PlatformLinkButton, PrimaryButton, TextButton } from "../components/Button";
import { Logo } from "../components/Logo";
import { SteamApiKeyForm } from "../components/SteamApiKeyForm";
import { Toast } from "../components/Toast";
import { cancelSteamLogin, isPlatformAvailable, linkPlatform, steamLogin, unlinkPlatform } from "../lib/accounts";
import { errorMessage, inTauri } from "../lib/tauri";
import { useAppStore } from "../store/appStore";
import { useLibrary } from "../store/useLibrary";
import type { Platform } from "../types";
import styles from "./Login.module.css";

const PLATFORMS: Platform[] = ["steam", "epic", "gog"];

/** Inicio: iniciar sesión con Steam (o entrar con un perfil local) y vincular plataformas (§6.1). */
export function Login() {
  const username = useAppStore((s) => s.username);
  return (
    <main className={styles.screen}>
      <div className={styles.card}>
        <h1 className={styles.logo}>
          <Logo size="lg" />
        </h1>
        {username ? <LinkPlatforms /> : <SignIn />}
      </div>
    </main>
  );
}

function SignIn() {
  const setUsername = useAppStore((s) => s.setUsername);
  const signInWithSteam = useAppStore((s) => s.signInWithSteam);
  const [waiting, setWaiting] = useState(false);
  const [localOpen, setLocalOpen] = useState(false);
  const [localName, setLocalName] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Si se sale de la pantalla con el navegador aún abierto, el intento se cancela.
  useEffect(() => {
    if (!waiting) return;
    return () => void cancelSteamLogin();
  }, [waiting]);

  const onSteam = async () => {
    setError(null);
    setWaiting(true);
    try {
      signInWithSteam(await steamLogin());
    } catch (err) {
      const message = errorMessage(err);
      // "cancelado": el usuario pulsó Cancelar; no es un error.
      if (message !== "cancelado") setError(message);
    } finally {
      setWaiting(false);
    }
  };

  const onCancel = () => {
    void cancelSteamLogin();
    setWaiting(false);
  };

  const onLocal = (e: FormEvent) => {
    e.preventDefault();
    const clean = localName.trim().slice(0, 40);
    if (!clean) {
      setError("Escribe un nombre para tu perfil.");
      return;
    }
    setError(null);
    setUsername(clean);
  };

  return (
    <section className={styles.form} aria-labelledby="signin-heading">
      <h2 id="signin-heading" className={styles.heading}>
        Iniciar sesión
      </h2>
      {waiting ? (
        <div className={styles.waiting} role="status">
          <p className={styles.waitingText}>Abrimos Steam en tu navegador. Inicia sesión allí y vuelve a LPhoton.</p>
          <TextButton onClick={onCancel}>Cancelar</TextButton>
        </div>
      ) : (
        <button type="button" className={styles.steamButton} onClick={() => void onSteam()}>
          <PlatformIcon platform="steam" className={styles.steamIcon} />
          Iniciar sesión con Steam
        </button>
      )}
      <p className={styles.note}>
        Tu contraseña se escribe en la página oficial de Steam, nunca en LPhoton. Solo recibimos tu nombre y tu avatar
        públicos.
      </p>
      {localOpen ? (
        <form className={styles.localForm} onSubmit={onLocal} noValidate>
          <label className={styles.field}>
            <span className={styles.label}>Nombre del perfil</span>
            <input
              className={styles.input}
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              maxLength={40}
              autoComplete="nickname"
              autoFocus
            />
          </label>
          <PrimaryButton type="submit" className={styles.localSubmit}>
            Continuar
          </PrimaryButton>
        </form>
      ) : (
        <TextButton className={styles.localLink} onClick={() => setLocalOpen(true)} disabled={waiting}>
          No uso Steam: continuar con un perfil local
        </TextButton>
      )}
      {error && <Toast tone="error">{error}</Toast>}
    </section>
  );
}

function LinkPlatforms() {
  const navigate = useNavigate();
  const username = useAppStore((s) => s.username) ?? "";
  const steamAccount = useAppStore((s) => s.steamAccount);
  const signOut = useAppStore((s) => s.signOut);
  const linked = useAppStore((s) => s.linkedPlatforms);
  const setPlatformLinked = useAppStore((s) => s.setPlatformLinked);
  const [busy, setBusy] = useState<Platform | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  // La biblioteca se lee desde la caché/escaneo local; el conteo sale de ahí.
  const { entries, status } = useLibrary();
  const syncing = useAppStore((s) => s.syncing);
  const detected = linked.length > 0 && status === "ready" ? entries.length : null;

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
    <>
      <div className={styles.account}>
        {steamAccount?.avatar ? (
          <img className={styles.avatar} src={steamAccount.avatar} alt="" width={48} height={48} />
        ) : (
          <span className={styles.avatar} aria-hidden="true">
            {username.trim().charAt(0).toUpperCase() || "?"}
          </span>
        )}
        <div className={styles.accountText}>
          <p className={styles.welcome}>
            Hola, <b>{username}</b>. Vincula tus plataformas para armar tu biblioteca.
          </p>
          <TextButton className={styles.localLink} onClick={signOut}>
            {steamAccount ? "Usar otra cuenta" : "Cambiar de perfil"}
          </TextButton>
        </div>
      </div>

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
    </>
  );
}
