import { useLayoutEffect } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { NavBar } from "./components/NavBar";
import { useAppStore } from "./store/appStore";
import { DevComponents } from "./screens/DevComponents";
import { Forums } from "./screens/Forums";
import { GameDetail } from "./screens/GameDetail";
import { LaunchScreen } from "./screens/LaunchScreen";
import { Library } from "./screens/Library";
import { Login } from "./screens/Login";
import { Profile } from "./screens/Profile";
import { Settings } from "./screens/Settings";
import styles from "./App.module.css";

/** El Login se muestra solo mientras no haya ninguna plataforma vinculada (§6.1). */
function RequireLinked() {
  const linked = useAppStore((s) => s.linkedPlatforms);
  return linked.length > 0 ? <Outlet /> : <Navigate to="/login" replace />;
}

function MainLayout() {
  return (
    <div className={styles.shell}>
      <NavBar />
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

export function App() {
  const theme = useAppStore((s) => s.theme);
  // Antes de pintar, para que no parpadee el tema oscuro.
  useLayoutEffect(() => {
    // La pantalla de carga fija su propio tema (siempre oscuro).
    if (window.location.pathname.startsWith("/cargando/")) return;
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dev/componentes" element={<DevComponents />} />
        <Route element={<RequireLinked />}>
          <Route element={<MainLayout />}>
            <Route path="/biblioteca" element={<Library />} />
            <Route path="/juego/:id" element={<GameDetail />} />
            <Route path="/foros" element={<Forums />} />
            <Route path="/configuraciones" element={<Settings />} />
            <Route path="/perfil" element={<Profile />} />
          </Route>
          <Route path="/cargando/:id" element={<LaunchScreen />} />
        </Route>
        <Route path="*" element={<Navigate to="/biblioteca" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
