//! Backend de LPhoton (Tauri 2).
//!
//! Fase 1: solo existe la estructura de módulos. La UI usa datos simulados
//! desde `src/lib/*.ts`; en las fases 2-4 esos wrappers pasarán a llamar a los
//! comandos de `commands.rs` con `invoke`, sin cambiar la interfaz.

mod commands;
mod db;
mod launcher;
mod library;
mod lightmode;
mod metrics;
mod platform;

use std::time::Instant;

pub fn run() {
    let started = Instant::now();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![commands::app_version])
        .setup(move |_app| {
            // RNF7: en la fase 2 se registra en el log como `startup_ms`.
            println!("startup_ms={}", started.elapsed().as_millis());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error al iniciar LPhoton");
}
