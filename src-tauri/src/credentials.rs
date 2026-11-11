//! Credenciales en el administrador de credenciales de Windows (crate `keyring`).
//! Nunca se guardan en texto plano ni en la base SQLite (LPHOTON.md §7.1).

use keyring::Entry;

const SERVICE: &str = "LPhoton";
const STEAM_API_KEY: &str = "steam_api_key";

fn entry(name: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, name).map_err(|e| e.to_string())
}

pub fn steam_api_key() -> Option<String> {
    entry(STEAM_API_KEY).ok()?.get_password().ok().filter(|k| !k.is_empty())
}

pub fn set_steam_api_key(key: &str) -> Result<(), String> {
    entry(STEAM_API_KEY)?.set_password(key).map_err(|e| e.to_string())
}

pub fn clear_steam_api_key() -> Result<(), String> {
    match entry(STEAM_API_KEY)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

/// Las API keys de Steam son 32 caracteres hexadecimales.
pub fn is_valid_steam_api_key(key: &str) -> bool {
    key.len() == 32 && key.chars().all(|c| c.is_ascii_hexdigit())
}

#[cfg(test)]
mod tests {
    use super::is_valid_steam_api_key;

    #[test]
    fn validates_key_format() {
        assert!(is_valid_steam_api_key("0123456789ABCDEF0123456789abcdef"));
        assert!(!is_valid_steam_api_key("demasiado-corta"));
        assert!(!is_valid_steam_api_key("0123456789ABCDEF0123456789abcdeZ"));
    }
}
