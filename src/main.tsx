import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/global.css";

// RNF7: tiempo hasta el primer render (en fase 2 se registra en el log como startup_ms).
const t0 = performance.now();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

requestAnimationFrame(() => {
  if (import.meta.env.DEV) console.info(`[LPhoton] primer render en ${Math.round(performance.now() - t0)} ms`);
});
