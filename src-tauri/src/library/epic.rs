//! Epic Games (RF1, LPHOTON.md §7.1).
//!
//! Sin API pública oficial: el MVP usa los manifiestos locales
//! `%ProgramData%\Epic\EpicGamesLauncher\Data\Manifests\*.item` (juegos instalados).
//! Lanzamiento: `com.epicgames.launcher://apps/<ns>:<item>:<app>?action=launch&silent=true`.

use std::fs;
use std::path::{Path, PathBuf};

use serde::Deserialize;

use crate::models::{Game, GameSource, Platform};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct Manifest {
    #[serde(default)]
    display_name: String,
    #[serde(default)]
    app_name: String,
    #[serde(default)]
    catalog_namespace: String,
    #[serde(default)]
    catalog_item_id: String,
    #[serde(default)]
    main_game_app_name: String,
    #[serde(default)]
    app_categories: Vec<String>,
    #[serde(default, rename = "bIsIncompleteInstall")]
    is_incomplete_install: bool,
}

#[derive(Debug, Clone)]
pub struct EpicApp {
    pub app_name: String,
    pub namespace: String,
    pub item_id: String,
    pub title: String,
    pub installed: bool,
}

impl EpicApp {
    /// Identificador que se guarda en `GameSource::external_id`: `ns:item:app`.
    pub fn external_id(&self) -> String {
        format!("{}:{}:{}", self.namespace, self.item_id, self.app_name)
    }
}

pub fn manifests_dir() -> Option<PathBuf> {
    let program_data = std::env::var_os("ProgramData").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(r"C:\ProgramData"));
    let dir = program_data.join(r"Epic\EpicGamesLauncher\Data\Manifests");
    dir.is_dir().then_some(dir)
}

/// Lee los manifiestos `.item` y devuelve solo juegos (sin aplicaciones ni DLC).
pub fn installed_apps(dir: &Path) -> Vec<EpicApp> {
    let Ok(entries) = fs::read_dir(dir) else { return Vec::new() };
    entries
        .flatten()
        .filter(|e| e.path().extension().is_some_and(|x| x.eq_ignore_ascii_case("item")))
        .filter_map(|e| fs::read(e.path()).ok())
        .filter_map(|bytes| serde_json::from_slice::<Manifest>(&bytes).ok())
        .filter_map(manifest_to_app)
        .collect()
}

fn manifest_to_app(m: Manifest) -> Option<EpicApp> {
    let is_game = m.app_categories.iter().any(|c| c.eq_ignore_ascii_case("games"));
    let is_dlc = !m.main_game_app_name.is_empty() && m.main_game_app_name != m.app_name;
    if !is_game || is_dlc || m.app_name.is_empty() || m.display_name.is_empty() {
        return None;
    }
    Some(EpicApp {
        app_name: m.app_name,
        namespace: m.catalog_namespace,
        item_id: m.catalog_item_id,
        title: m.display_name,
        installed: !m.is_incomplete_install,
    })
}

pub fn build_games(apps: &[EpicApp]) -> Vec<Game> {
    apps.iter()
        .map(|app| Game {
            id: format!("epic-{}", app.app_name),
            title: app.title.clone(),
            sources: vec![GameSource {
                platform: Platform::Epic,
                external_id: app.external_id(),
                installed: app.installed,
                // Epic no expone horas jugadas en archivos locales.
                playtime_minutes: 0,
                last_played: None,
            }],
        })
        .collect()
}

/// URI de lanzamiento silencioso. `external_id` = `ns:item:app`.
pub fn launch_uri(external_id: &str) -> Option<String> {
    let parts: Vec<&str> = external_id.split(':').collect();
    let valid = |s: &str| !s.is_empty() && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.');
    if parts.len() != 3 || !parts.iter().all(|p| valid(p)) {
        return None;
    }
    Some(format!(
        "com.epicgames.launcher://apps/{}%3A{}%3A{}?action=launch&silent=true",
        parts[0], parts[1], parts[2]
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn manifest(json: &str) -> Option<EpicApp> {
        manifest_to_app(serde_json::from_str(json).unwrap())
    }

    #[test]
    fn keeps_games_and_skips_apps_and_dlc() {
        let game = manifest(
            r#"{"DisplayName":"Fortnite","AppName":"Fortnite","CatalogNamespace":"fn","CatalogItemId":"abc",
                "MainGameAppName":"","AppCategories":["games","applications"],"bIsIncompleteInstall":false}"#,
        )
        .unwrap();
        assert_eq!(game.external_id(), "fn:abc:Fortnite");
        assert!(game.installed);

        assert!(manifest(r#"{"DisplayName":"Discord","AppName":"x","AppCategories":["public","software","applications"]}"#).is_none());
        assert!(manifest(r#"{"DisplayName":"DLC","AppName":"dlc1","MainGameAppName":"Base","AppCategories":["games"]}"#).is_none());
    }

    #[test]
    fn builds_launch_uri_and_rejects_injection() {
        assert_eq!(
            launch_uri("fn:abc:Fortnite").as_deref(),
            Some("com.epicgames.launcher://apps/fn%3Aabc%3AFortnite?action=launch&silent=true")
        );
        assert!(launch_uri("fn:abc").is_none());
        assert!(launch_uri("fn:abc:Fortnite&x=1").is_none());
    }
}

/// Prueba manual: `cargo test real_epic -- --ignored --nocapture`.
#[cfg(test)]
mod real_machine {
    #[test]
    #[ignore]
    fn real_epic() {
        let dir = super::manifests_dir().expect("Epic no detectado");
        for app in super::installed_apps(&dir) {
            println!("{} installed={} id={} uri={:?}", app.title, app.installed, app.external_id(), super::launch_uri(&app.external_id()));
        }
    }
}
