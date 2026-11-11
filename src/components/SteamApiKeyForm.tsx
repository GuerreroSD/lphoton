import { useEffect, useState, type FormEvent } from "react";
import { getSteamStatus, removeSteamApiKey, saveSteamApiKey, STEAM_API_KEY_URL } from "../lib/accounts";
import { errorMessage, openExternal } from "../lib/tauri";
import { useAppStore } from "../store/appStore";
import type { SteamStatus } from "../types";
import { PrimaryButton, TextButton } from "./Button";
import styles from "./SteamApiKeyForm.module.css";
import { Toast } from "./Toast";

/**
 * API key de Steam (opcional). Sin ella se muestran los juegos instalados;
 * con ella, toda la biblioteca de la cuenta. La key se guarda en el
 * administrador de credenciales de Windows desde el backend.
 */
export function SteamApiKeyForm() {
  const refreshLibrary = useAppStore((s) => s.refreshLibrary);
  const [status, setStatus] = useState<SteamStatus | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    getSteamStatus()
      .then((s) => alive && setStatus(s))
      .catch((err) => alive && setMessage({ tone: "error", text: errorMessage(err) }));
    return () => {
      alive = false;
    };
  }, []);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const count = await saveSteamApiKey(key);
      setKey("");
      setStatus((s) => (s ? { ...s, hasApiKey: true } : s));
      setMessage({ tone: "success", text: `Listo: tu cuenta de Steam tiene ${count} juegos.` });
      void refreshLibrary();
    } catch (err) {
      setMessage({ tone: "error", text: errorMessage(err, "No pudimos validar la API key.") });
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await removeSteamApiKey();
      setStatus((s) => (s ? { ...s, hasApiKey: false } : s));
      setMessage({ tone: "success", text: "API key eliminada. Se mostrarán solo tus juegos instalados." });
      void refreshLibrary();
    } catch (err) {
      setMessage({ tone: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  if (!status) return null;

  return (
    <div className={styles.box}>
      <p className={styles.state}>
        {status.detected ? "Steam detectado en este equipo" : "Steam no está instalado"}
        {status.steamId && " · cuenta detectada"}
        {status.hasApiKey && " · API key guardada"}
      </p>

      {status.hasApiKey ? (
        <TextButton onClick={onRemove} disabled={busy}>
          Quitar API key
        </TextButton>
      ) : (
        <form className={styles.form} onSubmit={onSave} noValidate>
          <p className={styles.help}>
            Opcional: con tu API key también verás los juegos que no tienes instalados y tus horas exactas.{" "}
            <TextButton onClick={() => void openExternal(STEAM_API_KEY_URL)}>Obtener API key →</TextButton>
          </p>
          <label className={styles.field}>
            <span className={styles.label}>API key de Steam</span>
            <input
              className={styles.input}
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="32 caracteres"
              autoComplete="off"
              spellCheck={false}
              maxLength={64}
            />
          </label>
          <PrimaryButton type="submit" disabled={busy || key.trim().length === 0 || !status.detected}>
            {busy ? "Validando…" : "Guardar"}
          </PrimaryButton>
        </form>
      )}

      {message && <Toast tone={message.tone}>{message.text}</Toast>}
    </div>
  );
}
