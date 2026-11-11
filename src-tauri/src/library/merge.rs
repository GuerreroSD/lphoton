//! Fusión de juegos repetidos entre tiendas (fase 3).

/// Normaliza un título para comparar entre tiendas: minúsculas, sin símbolos
/// ni sufijos ™/®.
#[allow(dead_code)]
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

#[cfg(test)]
mod tests {
    use super::normalize_title;

    #[test]
    fn strips_symbols_and_case() {
        assert_eq!(normalize_title("Resident Evil™ Requiem®"), "resident evil requiem");
        assert_eq!(normalize_title("Resident Evil 7: Biohazard"), "resident evil 7 biohazard");
    }
}
