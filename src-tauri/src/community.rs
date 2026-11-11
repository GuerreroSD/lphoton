//! Comunidad (RF4, LPHOTON.md §6.6).
//!
//! Soluciones técnicas y mods de rendimiento que el usuario guarda por juego,
//! ordenados por votos (SQLite, solo en este equipo). Complementa el enlace a
//! PCGamingWiki, que se abre en el navegador del sistema: su API automática
//! está detrás de un control anti-bots y no se elude.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FixKind {
    /// Solución técnica (crash al iniciar, pantalla negra…).
    Fix,
    /// Mod o ajuste de rendimiento.
    Mod,
}

impl FixKind {
    pub fn as_str(self) -> &'static str {
        match self {
            FixKind::Fix => "fix",
            FixKind::Mod => "mod",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "fix" => Some(FixKind::Fix),
            "mod" => Some(FixKind::Mod),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommunityFix {
    pub id: i64,
    pub game_id: String,
    pub kind: FixKind,
    pub title: String,
    pub description: String,
    pub url: Option<String>,
    pub votes: i64,
    /// Segundos Unix.
    pub created_at: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewFix {
    pub game_id: String,
    pub kind: FixKind,
    pub title: String,
    pub description: String,
    pub url: Option<String>,
}

const MAX_TITLE: usize = 120;
const MAX_DESCRIPTION: usize = 2000;
const MAX_URL: usize = 500;

/// Limpia y valida una solución nueva. Devuelve un mensaje claro si algo falla.
pub fn validate(mut fix: NewFix) -> Result<NewFix, String> {
    fix.title = fix.title.trim().to_string();
    fix.description = fix.description.trim().to_string();
    fix.url = fix.url.map(|u| u.trim().to_string()).filter(|u| !u.is_empty());

    if fix.game_id.trim().is_empty() {
        return Err("Falta el juego.".into());
    }
    if fix.title.is_empty() {
        return Err("Escribe un título para la solución.".into());
    }
    if fix.title.chars().count() > MAX_TITLE {
        return Err(format!("El título puede tener hasta {MAX_TITLE} caracteres."));
    }
    if fix.description.chars().count() > MAX_DESCRIPTION {
        return Err(format!("La descripción puede tener hasta {MAX_DESCRIPTION} caracteres."));
    }
    if let Some(url) = &fix.url {
        let lower = url.to_ascii_lowercase();
        let ok_scheme = lower.starts_with("https://") || lower.starts_with("http://");
        if !ok_scheme || url.len() > MAX_URL || url.chars().any(char::is_whitespace) {
            return Err("El enlace debe empezar con https:// (o http://).".into());
        }
    }
    Ok(fix)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn new_fix(title: &str, url: Option<&str>) -> NewFix {
        NewFix {
            game_id: "steam-10".into(),
            kind: FixKind::Fix,
            title: title.into(),
            description: " desc ".into(),
            url: url.map(str::to_string),
        }
    }

    #[test]
    fn validates_and_trims() {
        let ok = validate(new_fix("  Pantalla negra  ", Some(" https://www.pcgamingwiki.com/wiki/X "))).unwrap();
        assert_eq!(ok.title, "Pantalla negra");
        assert_eq!(ok.description, "desc");
        assert_eq!(ok.url.as_deref(), Some("https://www.pcgamingwiki.com/wiki/X"));
        assert!(validate(new_fix("Sin enlace", Some("   "))).unwrap().url.is_none());
    }

    #[test]
    fn rejects_bad_input() {
        assert!(validate(new_fix("   ", None)).is_err());
        assert!(validate(new_fix("x", Some("javascript:alert(1)"))).is_err());
        assert!(validate(new_fix("x", Some("file:///C:/Windows"))).is_err());
        assert!(validate(new_fix(&"a".repeat(121), None)).is_err());
    }
}
