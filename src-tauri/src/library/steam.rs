//! Steam (RF1, LPHOTON.md §7.1).
//!
//! - Local, sin red: ruta de Steam en el registro, `libraryfolders.vdf`,
//!   `appmanifest_*.acf` (instalados) y `localconfig.vdf` (horas jugadas).
//! - Opcional, con API key: `IPlayerService/GetOwnedGames` (biblioteca completa).
//! - `appdetails` de la tienda para descripción, género, desarrollador y año.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::Deserialize;

use super::vdf::{self, Vdf};
use crate::models::{unix_to_iso, Game, GameDetails, GameSource, Platform};

/// Diferencia entre SteamID64 y el AccountID (SteamID3) de `userdata/`.
const STEAMID64_BASE: u64 = 76_561_197_960_265_728;

/// Aplicaciones que no son juegos (redistribuibles, runtimes, herramientas).
const NON_GAME_APPIDS: &[u32] = &[
    228_980,   // Steamworks Common Redistributables
    1_070_560, // Steam Linux Runtime
    1_391_110, // Steam Linux Runtime – Soldier
    1_628_350, // Steam Linux Runtime – Sniper
    1_493_710, // Proton Experimental
    250_820,   // SteamVR
    1_826_330, // Proton EasyAntiCheat Runtime
    1_161_040, // Proton BattlEye Runtime
];

#[derive(Debug, Clone)]
pub struct LocalApp {
    pub appid: u32,
    pub name: String,
    pub installed: bool,
    pub last_played: u64,
}

#[derive(Debug, Clone, Copy, Default)]
pub struct LocalPlaytime {
    pub minutes: u64,
    pub last_played: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OwnedGame {
    pub appid: u32,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub playtime_forever: u64,
    #[serde(default)]
    pub rtime_last_played: u64,
}

pub fn is_game(appid: u32, name: &str) -> bool {
    !NON_GAME_APPIDS.contains(&appid)
        && !name.starts_with("Proton ")
        && !name.starts_with("Steam Linux Runtime")
        && !name.starts_with("Steamworks Common")
}

// ── Detección de la instalación ─────────────────────────────────────────

/// Carpeta raíz de Steam (`HKCU\Software\Valve\Steam\SteamPath`).
pub fn steam_root() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        use winreg::enums::HKEY_CURRENT_USER;
        use winreg::RegKey;
        let key = RegKey::predef(HKEY_CURRENT_USER).open_subkey(r"Software\Valve\Steam").ok()?;
        let path: String = key.get_value("SteamPath").ok()?;
        let path = PathBuf::from(path.replace('/', "\\"));
        path.is_dir().then_some(path)
    }
    #[cfg(not(windows))]
    {
        None
    }
}

pub fn steam_exe(root: &Path) -> PathBuf {
    root.join("steam.exe")
}

/// `true` si el cliente de Steam está abierto (Steam deja su PID en el registro).
pub fn is_running() -> bool {
    #[cfg(windows)]
    {
        use winreg::enums::HKEY_CURRENT_USER;
        use winreg::RegKey;
        RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey(r"Software\Valve\Steam\ActiveProcess")
            .and_then(|k| k.get_value::<u32, _>("pid"))
            .map(|pid| pid != 0)
            .unwrap_or(false)
    }
    #[cfg(not(windows))]
    {
        false
    }
}

/// SteamID64 del usuario: el que tiene la sesión activa o, si Steam está
/// cerrado, el más reciente de `config/loginusers.vdf`.
pub fn detect_steam_id(root: &Path) -> Option<u64> {
    #[cfg(windows)]
    {
        use winreg::enums::HKEY_CURRENT_USER;
        use winreg::RegKey;
        let active = RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey(r"Software\Valve\Steam\ActiveProcess")
            .and_then(|k| k.get_value::<u32, _>("ActiveUser"))
            .unwrap_or(0);
        if active != 0 {
            return Some(STEAMID64_BASE + u64::from(active));
        }
    }

    let doc = read_vdf(&root.join("config").join("loginusers.vdf"))?;
    let users = doc.get("users")?;
    let mut best: Option<(bool, u64, u64)> = None; // (MostRecent, timestamp, id)
    for (id, user) in users.entries() {
        let Ok(id) = id.parse::<u64>() else { continue };
        let recent = user.str_at("MostRecent") == Some("1");
        let ts = user.str_at("Timestamp").and_then(|t| t.parse().ok()).unwrap_or(0);
        if best.is_none_or(|b| (recent, ts) > (b.0, b.1)) {
            best = Some((recent, ts, id));
        }
    }
    best.map(|b| b.2)
}

fn read_vdf(path: &Path) -> Option<Vdf> {
    let bytes = fs::read(path).ok()?;
    vdf::parse(&String::from_utf8_lossy(&bytes))
}

// ── Juegos locales ──────────────────────────────────────────────────────

/// Carpetas de biblioteca (`steamapps/libraryfolders.vdf`), incluida la raíz.
pub fn library_folders(root: &Path) -> Vec<PathBuf> {
    let mut folders = vec![root.to_path_buf()];
    if let Some(doc) = read_vdf(&root.join("steamapps").join("libraryfolders.vdf")) {
        if let Some(list) = doc.get("libraryfolders") {
            for (_, folder) in list.entries() {
                if let Some(path) = folder.str_at("path") {
                    let path = PathBuf::from(path);
                    if !folders.iter().any(|f| same_path(f, &path)) {
                        folders.push(path);
                    }
                }
            }
        }
    }
    folders
}

fn same_path(a: &Path, b: &Path) -> bool {
    a.to_string_lossy().to_lowercase().trim_end_matches('\\') == b.to_string_lossy().to_lowercase().trim_end_matches('\\')
}

/// Lee todos los `appmanifest_*.acf` de todas las bibliotecas.
pub fn installed_apps(root: &Path) -> Vec<LocalApp> {
    let mut apps: HashMap<u32, LocalApp> = HashMap::new();
    for folder in library_folders(root) {
        let Ok(dir) = fs::read_dir(folder.join("steamapps")) else { continue };
        for entry in dir.flatten() {
            let name = entry.file_name();
            let name = name.to_string_lossy();
            if !(name.starts_with("appmanifest_") && name.ends_with(".acf")) {
                continue;
            }
            let Some(doc) = read_vdf(&entry.path()) else { continue };
            let Some(state) = doc.get("AppState") else { continue };
            let Some(appid) = state.str_at("appid").and_then(|a| a.parse::<u32>().ok()) else { continue };
            let title = state.str_at("name").unwrap_or_default().to_string();
            if title.is_empty() || !is_game(appid, &title) {
                continue;
            }
            let flags: u32 = state.str_at("StateFlags").and_then(|f| f.parse().ok()).unwrap_or(0);
            let last_played = state.str_at("LastPlayed").and_then(|t| t.parse().ok()).unwrap_or(0);
            apps.insert(
                appid,
                LocalApp {
                    appid,
                    name: title,
                    // Bit 4 = "FullyInstalled".
                    installed: flags & 4 != 0,
                    last_played,
                },
            );
        }
    }
    apps.into_values().collect()
}

/// Horas jugadas y última sesión por AppID desde `userdata/<id>/config/localconfig.vdf`.
pub fn local_playtime(root: &Path, steam_id: u64) -> HashMap<u32, LocalPlaytime> {
    let mut out = HashMap::new();
    let Some(account_id) = steam_id.checked_sub(STEAMID64_BASE) else { return out };
    let path = root.join("userdata").join(account_id.to_string()).join("config").join("localconfig.vdf");
    let Some(doc) = read_vdf(&path) else { return out };
    let Some(apps) = doc.path(&["UserLocalConfigStore", "Software", "Valve", "Steam", "apps"]) else {
        return out;
    };
    for (appid, app) in apps.entries() {
        let Ok(appid) = appid.parse::<u32>() else { continue };
        let minutes = app.str_at("Playtime").and_then(|p| p.parse().ok()).unwrap_or(0);
        let last_played = app.str_at("LastPlayed").and_then(|p| p.parse().ok()).unwrap_or(0);
        out.insert(appid, LocalPlaytime { minutes, last_played });
    }
    out
}

/// Ruta de una imagen en la caché local del cliente de Steam, si existe.
/// `file` es p. ej. `library_600x900.jpg` o `library_hero.jpg`.
pub fn local_library_image(root: &Path, appid: u32, file: &str) -> Option<PathBuf> {
    let cache = root.join("appcache").join("librarycache");
    // Formato antiguo: librarycache/<appid>_library_600x900.jpg
    let flat = cache.join(format!("{appid}_{file}"));
    if flat.is_file() {
        return Some(flat);
    }
    // Formato actual: librarycache/<appid>/library_600x900.jpg (a veces en una subcarpeta con hash).
    let dir = cache.join(appid.to_string());
    let direct = dir.join(file);
    if direct.is_file() {
        return Some(direct);
    }
    fs::read_dir(&dir)
        .ok()?
        .flatten()
        .map(|e| e.path().join(file))
        .find(|p| p.is_file())
}

// ── Steam Web API ───────────────────────────────────────────────────────

#[derive(Deserialize)]
struct OwnedGamesEnvelope {
    response: OwnedGamesResponse,
}

#[derive(Deserialize)]
struct OwnedGamesResponse {
    #[serde(default)]
    games: Vec<OwnedGame>,
}

#[derive(Debug)]
pub enum ApiError {
    /// API key inválida o revocada (HTTP 401/403).
    Unauthorized,
    /// El perfil o los "detalles de juego" son privados: la respuesta llega vacía.
    PrivateProfile,
    Network(String),
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ApiError::Unauthorized => write!(f, "La API key de Steam no es válida."),
            ApiError::PrivateProfile => write!(
                f,
                "Steam no devolvió juegos. Revisa que los detalles de juego de tu perfil sean públicos."
            ),
            ApiError::Network(e) => write!(f, "No pudimos conectar con Steam ({e})."),
        }
    }
}

pub fn http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent(concat!("LPhoton/", env!("CARGO_PKG_VERSION")))
        .build()
        .expect("cliente HTTP")
}

/// `IPlayerService/GetOwnedGames`: todos los juegos de la cuenta, con horas jugadas.
pub async fn owned_games(client: &reqwest::Client, api_key: &str, steam_id: u64) -> Result<Vec<OwnedGame>, ApiError> {
    let resp = client
        .get("https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/")
        .query(&[
            ("key", api_key),
            ("steamid", &steam_id.to_string()),
            ("include_appinfo", "1"),
            ("include_played_free_games", "1"),
            ("format", "json"),
        ])
        .send()
        .await
        .map_err(|e| ApiError::Network(e.without_url().to_string()))?;
    if matches!(resp.status().as_u16(), 401 | 403) {
        return Err(ApiError::Unauthorized);
    }
    let resp = resp.error_for_status().map_err(|e| ApiError::Network(e.without_url().to_string()))?;
    let body: OwnedGamesEnvelope = resp.json().await.map_err(|e| ApiError::Network(e.without_url().to_string()))?;
    if body.response.games.is_empty() {
        return Err(ApiError::PrivateProfile);
    }
    Ok(body.response.games.into_iter().filter(|g| is_game(g.appid, &g.name)).collect())
}

/// `store.steampowered.com/api/appdetails` en español.
pub async fn app_details(client: &reqwest::Client, appid: u32) -> Result<GameDetails, String> {
    let resp = client
        .get("https://store.steampowered.com/api/appdetails")
        .query(&[("appids", appid.to_string()), ("l", "spanish".into()), ("cc", "cl".into())])
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| e.without_url().to_string())?;
    let body: serde_json::Value = resp.json().await.map_err(|e| e.without_url().to_string())?;
    let data = &body[appid.to_string()]["data"];
    if data.is_null() {
        return Ok(GameDetails::default());
    }

    let join = |key: &str, field: Option<&str>| -> Option<String> {
        let items: Vec<String> = data[key]
            .as_array()?
            .iter()
            .filter_map(|v| match field {
                Some(f) => v[f].as_str(),
                None => v.as_str(),
            })
            .take(3)
            .map(str::to_string)
            .collect();
        (!items.is_empty()).then(|| items.join(" / "))
    };

    let release_year = data["release_date"]["date"].as_str().and_then(|date| {
        date.split(|c: char| !c.is_ascii_digit())
            .find(|part| part.len() == 4)
            .and_then(|y| y.parse().ok())
    });

    Ok(GameDetails {
        description: data["short_description"].as_str().map(clean_html).filter(|s| !s.is_empty()),
        genre: join("genres", Some("description")),
        developer: join("developers", None),
        release_year,
    })
}

/// La tienda devuelve HTML y entidades en las descripciones.
fn clean_html(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut in_tag = false;
    for c in input.chars() {
        match c {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => out.push(c),
            _ => {}
        }
    }
    out.replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&nbsp;", " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

// ── Unión de las fuentes de Steam ───────────────────────────────────────

/// Combina instalados, horas locales y (si hay) la biblioteca de la Web API.
pub fn build_games(
    installed: &[LocalApp],
    playtime: &HashMap<u32, LocalPlaytime>,
    owned: Option<&[OwnedGame]>,
) -> Vec<Game> {
    let mut by_id: HashMap<u32, (String, GameSource)> = HashMap::new();

    if let Some(owned) = owned {
        for g in owned {
            by_id.insert(
                g.appid,
                (
                    g.name.clone(),
                    source(g.appid, false, g.playtime_forever, g.rtime_last_played),
                ),
            );
        }
    }

    for app in installed {
        let local = playtime.get(&app.appid).copied().unwrap_or_default();
        let entry = by_id
            .entry(app.appid)
            .or_insert_with(|| (app.name.clone(), source(app.appid, false, 0, 0)));
        entry.1.installed = app.installed;
        // La Web API es la referencia de horas; localconfig sirve sin conexión.
        if entry.1.playtime_minutes == 0 {
            entry.1.playtime_minutes = local.minutes;
        }
        let last = app.last_played.max(local.last_played);
        if entry.1.last_played.is_none() && last > 0 {
            entry.1.last_played = Some(unix_to_iso(last));
        }
    }

    by_id
        .into_values()
        .map(|(title, src)| Game {
            id: format!("steam-{}", src.external_id),
            title,
            sources: vec![src],
        })
        .collect()
}

fn source(appid: u32, installed: bool, minutes: u64, last_played: u64) -> GameSource {
    GameSource {
        platform: Platform::Steam,
        external_id: appid.to_string(),
        installed,
        playtime_minutes: minutes,
        last_played: (last_played > 0).then(|| unix_to_iso(last_played)),
    }
}

// ── Lanzamiento (RF2) ───────────────────────────────────────────────────

/// Abre Steam en modo silencioso si no está corriendo y lanza el juego con
/// `steam://rungameid/<appid>`. No se abre ninguna ventana de consola.
pub fn launch(root: &Path, appid: u32) -> std::io::Result<()> {
    let exe = steam_exe(root);
    if !is_running() {
        hidden(std::process::Command::new(&exe).arg("-silent")).spawn()?;
    }
    // Igual que el manejador del protocolo steam:// registrado por Steam.
    hidden(std::process::Command::new(&exe).arg("--").arg(format!("steam://rungameid/{appid}"))).spawn()?;
    Ok(())
}

fn hidden(cmd: &mut std::process::Command) -> &mut std::process::Command {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filters_tools() {
        assert!(!is_game(228_980, "Steamworks Common Redistributables"));
        assert!(!is_game(1, "Proton 9.0"));
        assert!(is_game(2_050_650, "Resident Evil 4"));
    }

    #[test]
    fn merges_owned_and_installed() {
        let installed = vec![LocalApp { appid: 10, name: "Local".into(), installed: true, last_played: 100 }];
        let owned = vec![
            OwnedGame { appid: 10, name: "Remoto".into(), playtime_forever: 50, rtime_last_played: 0 },
            OwnedGame { appid: 20, name: "No instalado".into(), playtime_forever: 0, rtime_last_played: 0 },
        ];
        let mut games = build_games(&installed, &HashMap::new(), Some(&owned));
        games.sort_by(|a, b| a.id.cmp(&b.id));
        assert_eq!(games.len(), 2);
        assert_eq!(games[0].title, "Remoto");
        assert!(games[0].sources[0].installed);
        assert_eq!(games[0].sources[0].playtime_minutes, 50);
        assert_eq!(games[0].sources[0].last_played.as_deref(), Some("1970-01-01T00:01:40Z"));
        assert!(!games[1].sources[0].installed);
    }

    #[test]
    fn cleans_store_html() {
        assert_eq!(clean_html("<b>Hola</b> &amp; adi&oacute;s"), "Hola & adi&oacute;s");
    }
}

/// Prueba manual contra la instalación real: `cargo test real_steam -- --ignored --nocapture`.
#[cfg(test)]
mod real_machine {
    use super::*;

    #[test]
    #[ignore]
    fn real_steam() {
        let root = steam_root().expect("Steam no detectado");
        let id = detect_steam_id(&root);
        let installed = installed_apps(&root);
        let playtime = id.map(|i| local_playtime(&root, i)).unwrap_or_default();
        let games = build_games(&installed, &playtime, None);
        println!("root={} steam_id_detectado={} carpetas={}", root.display(), id.is_some(), library_folders(&root).len());
        println!("instalados={} juegos={} con_horas={}", installed.len(), games.len(), playtime.len());
        for g in games.iter().take(40) {
            let s = &g.sources[0];
            let cover = local_library_image(&root, s.external_id.parse().unwrap(), "library_600x900.jpg").is_some();
            println!("  {:<45} inst={} min={} last={:?} portada_local={}", g.title, s.installed, s.playtime_minutes, s.last_played, cover);
        }
    }
}
