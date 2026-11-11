//! Ejecución intervenida (RF2, LPHOTON.md §7.2). Fase 4.
//!
//! 1. Abrir el cliente nativo en modo silencioso si no está corriendo.
//! 2. Lanzar el juego con el URI/comando de la plataforma.
//! 3. Esperar el proceso del juego y emitir `launch-progress` al frontend:
//!    client-started → license-validated → game-detected → light-mode-applied.
//! 4. Ocultar ventanas visibles del cliente (tienda, ofertas).
