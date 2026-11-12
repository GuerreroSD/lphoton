import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PlatformLinkButton, TextButton } from "../components/Button";
import { Segmented, Switch } from "../components/Choice";
import { PlatformBadge } from "../components/PlatformBadge";
import { SteamApiKeyForm } from "../components/SteamApiKeyForm";
import { Toast } from "../components/Toast";
import { isPlatformAvailable, linkPlatform, unlinkPlatform } from "../lib/accounts";
import {
  DEFAULT_LIGHTMODE_TARGETS,
  getAppVersion,
  getAutostart,
  getInstallPaths,
  getLightmodeTargets,
  openInstallPath,
  setAutostart,
  setLightmodeTargets,
  validateTarget,
  type InstallPath,
} from "../lib/system";
import { errorMessage, inTauri } from "../lib/tauri";
import { checkForUpdate, type AvailableUpdate } from "../lib/updates";
import { useAppStore } from "../store/appStore";
import { PLATFORM_NAMES, type LightModePreference, type Platform, type Theme } from "../types";
import { SectionPage } from "./Page";
import page from "./Page.module.css";
import styles from "./Settings.module.css";

const PLATFORMS: Platform[] = ["steam", "epic", "gog"];

const LIGHT_MODE_OPTIONS: { value: LightModePreference; label: string }[] = [
  { value: "ask", label: "Preguntar" },
  { value: "always", label: "Siempre" },
  { value: "never", label: "Nunca" },
];

const LIGHT_MODE_HELP: Record<LightModePreference, string> = {
  ask: "Al pulsar JUGAR, si el cliente consume mucha RAM, LPhoton te pregunta si quieres activar el modo ligero.",
  always: "El modo ligero se activa en cada juego, sin preguntar.",
  never: "LPhoton nunca modifica los procesos de los clientes.",
};

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "dark", label: "Oscuro" },
  { value: "light", label: "Claro" },
];

/** Configuraciones (§6.7). */
export function Settings() {
  const hasSteamSection = useAppStore((s) => inTauri && s.linkedPlatforms.includes("steam"));
  const sections = useMemo(
    () => [
      { id: "settings-platforms", label: "Plataformas" },
      ...(hasSteamSection ? [{ id: "settings-steam", label: "Steam" }] : []),
      { id: "settings-lightmode", label: "Modo ligero" },
      { id: "settings-theme", label: "Apariencia" },
      { id: "settings-startup", label: "Inicio" },
      { id: "settings-paths", label: "Rutas de instalación" },
      { id: "settings-about", label: "Acerca de" },
    ],
    [hasSteamSection],
  );
  return (
    <SectionPage title="Configuraciones" sections={sections}>
      <PlatformsSection />
      <LightModeSection />
      <AppearanceSection />
      <StartupSection />
      <InstallPathsSection />
      <AboutSection />
    </SectionPage>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section className={page.section} aria-labelledby={id}>
      <h2 id={id} className={page.subtitle}>
        {title}
      </h2>
      {children}
    </section>
  );
}

// ── Plataformas ─────────────────────────────────────────────────────────

function PlatformsSection() {
  const linked = useAppStore((s) => s.linkedPlatforms);
  const setPlatformLinked = useAppStore((s) => s.setPlatformLinked);
  const [busy, setBusy] = useState<Platform | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Siempre debe quedar al menos una plataforma vinculada (si no, se vuelve al Login).
  const toggle = async (p: Platform) => {
    setBusy(p);
    setError(null);
    try {
      if (linked.includes(p)) {
        await unlinkPlatform(p);
        setPlatformLinked(p, false);
      } else {
        await linkPlatform(p);
        setPlatformLinked(p, true);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Section id="settings-platforms" title="Plataformas vinculadas">
        <div className={page.platformList}>
          {PLATFORMS.map((p) => (
            <PlatformLinkButton
              key={p}
              platform={p}
              linked={linked.includes(p)}
              busy={busy === p}
              unavailable={!isPlatformAvailable(p)}
              disabled={busy !== null || !isPlatformAvailable(p) || (linked.length === 1 && linked.includes(p))}
              onClick={() => toggle(p)}
            />
          ))}
        </div>
        {linked.length === 1 && <p className={styles.help}>Debe quedar al menos una plataforma vinculada.</p>}
        {error && <Toast tone="error">{error}</Toast>}
      </Section>
      {inTauri && linked.includes("steam") && (
        <Section id="settings-steam" title="Steam">
          <SteamApiKeyForm />
        </Section>
      )}
    </>
  );
}

// ── Modo ligero ─────────────────────────────────────────────────────────

function LightModeSection() {
  const pref = useAppStore((s) => s.lightModePref);
  const setPref = useAppStore((s) => s.setLightModePref);
  const [targets, setTargets] = useState<string[] | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLightmodeTargets()
      .then(setTargets)
      .catch(() => setTargets(DEFAULT_LIGHTMODE_TARGETS));
  }, []);

  const save = async (next: string[]) => {
    setError(null);
    try {
      setTargets(await setLightmodeTargets(next));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    const problem = validateTarget(draft, targets ?? []);
    if (problem) {
      setError(problem);
      return;
    }
    void save([...(targets ?? []), draft.trim()]);
    setDraft("");
  };

  const isDefault =
    targets !== null &&
    targets.length === DEFAULT_LIGHTMODE_TARGETS.length &&
    targets.every((t, i) => t === DEFAULT_LIGHTMODE_TARGETS[i]);

  return (
    <Section id="settings-lightmode" title="Modo ligero">
      <Segmented label="Activar el modo ligero" value={pref} options={LIGHT_MODE_OPTIONS} onChange={setPref} />
      <p className={styles.help}>{LIGHT_MODE_HELP[pref]}</p>

      <h3 className={styles.minor}>Procesos que se aligeran</h3>
      <p className={styles.help}>
        Mientras juegas, estos procesos auxiliares bajan a prioridad mínima y liberan su RAM. Al cerrar el juego todo
        vuelve a la normalidad. Los procesos principales (steam.exe, EpicGamesLauncher.exe, GalaxyClient.exe) nunca se
        tocan.
      </p>
      {targets && (
        <ul className={styles.targets} aria-label="Procesos del modo ligero">
          {targets.map((t) => (
            <li key={t} className={styles.target}>
              <span>{t}</span>
              <button
                type="button"
                className={styles.remove}
                aria-label={`Quitar ${t}`}
                title="Quitar"
                disabled={targets.length === 1}
                onClick={() => void save(targets.filter((x) => x !== t))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className={styles.addRow} onSubmit={onAdd} noValidate>
        <label htmlFor="target-name" className="visually-hidden">
          Nombre del proceso
        </label>
        <input
          id="target-name"
          className={styles.input}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          placeholder="proceso.exe"
          maxLength={64}
          spellCheck={false}
          autoComplete="off"
        />
        <TextButton type="submit">+ Agregar</TextButton>
        {!isDefault && (
          <TextButton onClick={() => void save(DEFAULT_LIGHTMODE_TARGETS)}>Restaurar predeterminados</TextButton>
        )}
      </form>
      {error && <Toast tone="error">{error}</Toast>}
    </Section>
  );
}

// ── Apariencia ──────────────────────────────────────────────────────────

function AppearanceSection() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  return (
    <Section id="settings-theme" title="Apariencia">
      <Segmented label="Tema" value={theme} options={THEME_OPTIONS} onChange={setTheme} />
    </Section>
  );
}

// ── Inicio con Windows ──────────────────────────────────────────────────

function StartupSection() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAutostart()
      .then(setEnabled)
      .catch(() => setEnabled(false));
  }, []);

  const toggle = async (next: boolean) => {
    setError(null);
    try {
      setEnabled(await setAutostart(next));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Section id="settings-startup" title="Inicio">
      <Switch
        label="Iniciar LPhoton con Windows"
        description="Se abre minimizado en la bandeja, sin ventanas. Desactivado por defecto."
        checked={enabled ?? false}
        disabled={enabled === null}
        onChange={(v) => void toggle(v)}
      />
      {error && <Toast tone="error">{error}</Toast>}
    </Section>
  );
}

// ── Rutas de instalación ────────────────────────────────────────────────

function InstallPathsSection() {
  const [paths, setPaths] = useState<InstallPath[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getInstallPaths()
      .then(setPaths)
      .catch((err) => setError(errorMessage(err, "No pudimos leer las rutas de instalación.")));
  }, []);

  return (
    <Section id="settings-paths" title="Rutas de instalación">
      <p className={styles.help}>
        Carpetas donde cada tienda instala tus juegos. Para cambiarlas o agregar otra, usa el cliente de la tienda:
        LPhoton las detecta solo.
      </p>
      {paths && paths.length === 0 && <p className={styles.help}>No encontramos carpetas de juegos en este equipo.</p>}
      {paths && paths.length > 0 && (
        <ul className={styles.paths}>
          {paths.map((p) => (
            <li key={`${p.platform}:${p.path}`} className={styles.path}>
              <PlatformBadge platform={p.platform} />
              <div className={styles.pathText}>
                <span className={styles.pathName} title={p.path}>
                  {p.path}
                </span>
                <span className={styles.pathMeta}>
                  {PLATFORM_NAMES[p.platform]} · {p.games} {p.games === 1 ? "juego" : "juegos"}
                </span>
              </div>
              {inTauri && (
                <TextButton
                  onClick={() => openInstallPath(p.path).catch((err) => setError(errorMessage(err)))}
                >
                  Abrir carpeta
                </TextButton>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <Toast tone="error">{error}</Toast>}
    </Section>
  );
}

// ── Acerca de ───────────────────────────────────────────────────────────

function AboutSection() {
  const [version, setVersion] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [installing, setInstalling] = useState(false);
  useEffect(() => {
    getAppVersion()
      .then(setVersion)
      .catch(() => setVersion(null));
  }, []);

  const onCheck = async () => {
    setChecking(true);
    setMessage(null);
    try {
      const found = await checkForUpdate();
      setUpdate(found);
      setMessage(
        found
          ? { tone: "info", text: `Hay una versión nueva: LPhoton ${found.version}.` }
          : { tone: "success", text: "Tienes la última versión." },
      );
    } catch (err) {
      setMessage({ tone: "error", text: errorMessage(err, "No pudimos buscar actualizaciones. Revisa tu conexión.") });
    } finally {
      setChecking(false);
    }
  };

  const onInstall = async () => {
    if (!update) return;
    setInstalling(true);
    setMessage({ tone: "info", text: "Descargando la actualización… LPhoton se reiniciará solo." });
    try {
      await update.install(() => undefined);
    } catch (err) {
      setInstalling(false);
      setMessage({ tone: "error", text: errorMessage(err, "No se pudo instalar la actualización.") });
    }
  };

  return (
    <Section id="settings-about" title="Acerca de">
      <p className={styles.help}>
        LPhoton {version ? `v${version}` : ""} · Sin anuncios, sin tienda y sin ventanas emergentes. Código abierto
        con licencia MIT.
      </p>
      {inTauri && (
        <div>
          {update ? (
            <TextButton onClick={() => void onInstall()} disabled={installing}>
              Actualizar a {update.version}
            </TextButton>
          ) : (
            <TextButton onClick={() => void onCheck()} disabled={checking}>
              {checking ? "Buscando…" : "Buscar actualizaciones"}
            </TextButton>
          )}
        </div>
      )}
      {message && <Toast tone={message.tone}>{message.text}</Toast>}
    </Section>
  );
}
