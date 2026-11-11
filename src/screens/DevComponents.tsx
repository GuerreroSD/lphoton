import { LightModeButton, NavButton, PlayButton, SearchIcon, SkipButton, type PreviewState } from "../components/Button";
import { Logo } from "../components/Logo";
import { NavBar } from "../components/NavBar";
import { PlatformBadge } from "../components/PlatformBadge";
import styles from "./DevComponents.module.css";

const NAV_LABELS = ["Biblioteca", "Foros", "Configuraciones", "Perfil"];

type Row = { name: string; preview?: PreviewState; disabled?: boolean };
const ROWS: Row[] = [
  { name: "Normal" },
  { name: "Hover", preview: "hover" },
  { name: "Deshabilitado / seleccionado", disabled: true },
];

/** Muestra de componentes en sus 3 estados, para comparar con la maqueta 00. */
export function DevComponents() {
  return (
    <main className={styles.page}>
      <h1 className="visually-hidden">Componentes de LPhoton</h1>

      <div className={styles.navbars}>
        <NavBar demoSelected={null} />
        <NavBar demoSelected="biblioteca" />
      </div>

      <div className={styles.matrix}>
        {ROWS.map((row) => (
          <div key={row.name} className={styles.row} aria-label={row.name}>
            {NAV_LABELS.map((label) => (
              <NavButton key={label} previewState={row.preview} disabled={row.disabled}>
                {label}
              </NavButton>
            ))}
            <PlayButton previewState={row.preview} disabled={row.disabled} />
            <SkipButton previewState={row.preview} disabled={row.disabled} />
            <LightModeButton previewState={row.preview} disabled={row.disabled} />
          </div>
        ))}
      </div>

      <div className={styles.extras}>
        <div className={styles.badges}>
          <PlatformBadge platform="steam" size="md" />
          <PlatformBadge platform="epic" size="md" />
          <PlatformBadge platform="gog" size="md" />
        </div>
        <Logo boxed size="lg" />
        <div className={styles.searchStates}>
          <SearchIcon />
          <SearchIcon previewState="hover" />
        </div>
      </div>

      <div className={styles.lightLogo}>
        <Logo size="lg" onLight />
      </div>
    </main>
  );
}
