//! Fusión de juegos repetidos entre tiendas (fase 3).
//! En la fase 2 solo hay Steam, pero la biblioteca ya pasa por aquí.

use std::collections::HashMap;

use crate::models::Game;

/// Normaliza un título para comparar entre tiendas: minúsculas, sin símbolos
/// ni sufijos ™/®.
pub fn normalize_title(title: &str) -> String {
    title
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect::<String>()
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Une los juegos con el mismo título normalizado en uno solo con varias `sources`.
pub fn merge(games: Vec<Game>) -> Vec<Game> {
    let mut by_title: HashMap<String, Game> = HashMap::new();
    for game in games {
        let key = normalize_title(&game.title);
        match by_title.get_mut(&key) {
            Some(existing) => {
                for src in game.sources {
                    let duplicate = existing
                        .sources
                        .iter()
                        .any(|s| s.platform == src.platform && s.external_id == src.external_id);
                    if !duplicate {
                        existing.sources.push(src);
                    }
                }
            }
            None => {
                by_title.insert(key, game);
            }
        }
    }
    by_title.into_values().collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{GameSource, Platform};

    fn game(id: &str, title: &str, platform: Platform) -> Game {
        Game {
            id: id.into(),
            title: title.into(),
            sources: vec![GameSource {
                platform,
                external_id: id.into(),
                installed: false,
                playtime_minutes: 0,
                last_played: None,
            }],
        }
    }

    #[test]
    fn strips_symbols_and_case() {
        assert_eq!(normalize_title("Resident Evil™ Requiem®"), "resident evil requiem");
        assert_eq!(normalize_title("Resident Evil 7: Biohazard"), "resident evil 7 biohazard");
    }

    #[test]
    fn merges_same_title_across_stores() {
        let merged = merge(vec![
            game("steam-1", "Resident Evil Requiem", Platform::Steam),
            game("epic-1", "RESIDENT EVIL™ Requiem", Platform::Epic),
            game("steam-2", "Otro", Platform::Steam),
        ]);
        assert_eq!(merged.len(), 2);
        let requiem = merged.iter().find(|g| g.title.contains("Requiem")).unwrap();
        assert_eq!(requiem.sources.len(), 2);
    }
}
