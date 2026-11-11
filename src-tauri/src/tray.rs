//! Bandeja del sistema y ciclo de vida de la ventana (RNF6, LPHOTON.md §7.4).
//!
//! El ícono vive siempre en la bandeja (como Steam). Al cerrar la ventana o al
//! empezar a jugar, LPhoton destruye su ventana (el WebView concentra casi toda
//! la RAM) y sigue en la bandeja. La ventana se recrea con un clic en el ícono
//! o en "Abrir LPhoton"; "Salir" cierra LPhoton por completo.

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, WebviewWindowBuilder};

use crate::AppState;

const TRAY_ID: &str = "lphoton-tray";
const MAIN_WINDOW: &str = "main";

/// Crea el ícono de la bandeja si no existe y actualiza su texto.
pub fn ensure(app: &AppHandle, tooltip: &str) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_tooltip(Some(tooltip));
        return;
    }
    let build = || -> tauri::Result<()> {
        let open_item = MenuItem::with_id(app, "open", "Abrir LPhoton", true, None::<&str>)?;
        let quit_item = MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?;
        let menu = Menu::with_items(app, &[&open_item, &quit_item])?;
        let mut builder = TrayIconBuilder::with_id(TRAY_ID)
            .tooltip(tooltip)
            .menu(&menu)
            .show_menu_on_left_click(false)
            .on_menu_event(|app, event| match event.id().as_ref() {
                "open" => show_main_window(app),
                "quit" => quit(app),
                _ => {}
            })
            .on_tray_icon_event(|tray, event| {
                if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                    show_main_window(tray.app_handle());
                }
            });
        if let Some(icon) = app.default_window_icon() {
            builder = builder.icon(icon.clone());
        }
        builder.build(app)?;
        Ok(())
    };
    if let Err(e) = build() {
        if let Some(state) = app.try_state::<AppState>() {
            crate::log_line(&state, &format!("tray error: {e}"));
        }
    }
}

/// Destruye la ventana principal (libera el WebView2) y deja el ícono de la bandeja.
pub fn minimize_to_tray(app: &AppHandle, tooltip: &str) {
    ensure(app, tooltip);
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.destroy();
    }
}

/// Muestra la ventana principal; si fue destruida, la recrea desde la configuración.
pub fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    } else if let Some(config) = app.config().app.windows.iter().find(|w| w.label == MAIN_WINDOW).cloned() {
        match WebviewWindowBuilder::from_config(app, &config).and_then(|b| b.build()) {
            Ok(window) => {
                let _ = window.set_focus();
            }
            Err(e) => {
                if let Some(state) = app.try_state::<AppState>() {
                    crate::log_line(&state, &format!("window recreate error: {e}"));
                }
            }
        }
    }
}

/// "Salir": restaura el modo ligero antes de cerrar.
pub fn quit(app: &AppHandle) {
    if let Some(state) = app.try_state::<AppState>() {
        crate::launcher::end_session(&state, "salida desde la bandeja");
    }
    app.exit(0);
}
