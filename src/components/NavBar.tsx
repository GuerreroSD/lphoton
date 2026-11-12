import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppStore } from "../store/appStore";
import { NavButton, SearchIcon } from "./Button";
import { Logo } from "./Logo";
import styles from "./NavBar.module.css";

export const NAV_ITEMS = [
  { id: "biblioteca", label: "Biblioteca", to: "/biblioteca" },
  { id: "foros", label: "Foros", to: "/foros" },
  { id: "configuraciones", label: "Configuraciones", to: "/configuraciones" },
  { id: "perfil", label: "Perfil", to: "/perfil" },
] as const;

export type NavId = (typeof NAV_ITEMS)[number]["id"];

interface NavBarProps {
  /**
   * Solo para /dev/componentes: muestra la barra sin navegación real
   * y con la pestaña indicada en estado "seleccionado" (o ninguna).
   */
  demoSelected?: NavId | null;
}

/** Barra superior común (§6.0): Logo · BIBLIOTECA · FOROS · CONFIGURACIONES · PERFIL · Lupa. */
export function NavBar({ demoSelected }: NavBarProps) {
  const navigate = useNavigate();
  const searchOpen = useAppStore((s) => s.searchOpen);
  const openSearch = useAppStore((s) => s.openSearch);
  const closeSearch = useAppStore((s) => s.closeSearch);
  const isDemo = demoSelected !== undefined;

  const onSearch = () => {
    if (isDemo) return;
    if (searchOpen) {
      closeSearch();
    } else {
      openSearch();
      navigate("/biblioteca");
    }
  };

  // Ctrl+K o Ctrl+F abren la búsqueda desde cualquier pantalla.
  useEffect(() => {
    if (isDemo) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key !== "k" && key !== "f") return;
      e.preventDefault();
      openSearch();
      navigate("/biblioteca");
      // Si ya estaba abierta, se devuelve el foco al campo.
      requestAnimationFrame(() => document.getElementById("library-search")?.focus());
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isDemo, openSearch, navigate]);

  return (
    <header className={styles.navbar}>
      {isDemo ? (
        <Logo boxed />
      ) : (
        <Link to="/biblioteca" className={styles.logoLink} aria-label="LPhoton, ir a la biblioteca">
          <Logo boxed />
        </Link>
      )}
      <nav className={styles.items} aria-label="Secciones">
        {NAV_ITEMS.map((item) =>
          isDemo ? (
            <NavButton key={item.id} selected={demoSelected === item.id}>
              {item.label}
            </NavButton>
          ) : (
            <NavButton key={item.id} to={item.to}>
              {item.label}
            </NavButton>
          ),
        )}
      </nav>
      <SearchIcon onClick={onSearch} active={!isDemo && searchOpen} title={isDemo ? undefined : "Buscar (Ctrl+K)"} />
    </header>
  );
}
