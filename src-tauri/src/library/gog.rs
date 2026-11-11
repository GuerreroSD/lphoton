//! GOG (RF1, LPHOTON.md §7.1).
//!
//! - Base de GOG Galaxy `%ProgramData%\GOG.com\Galaxy\storage\galaxy-2.1.db`
//!   (biblioteca completa, tiempo de juego, última sesión, instalados). Se lee
//!   desde una copia para no bloquear Galaxy.
//! - Registro `HKLM\SOFTWARE\WOW6432Node\GOG.com\Games\<id>`: juegos instalados
//!   (también los de instaladores offline, sin Galaxy).
//! - `goggame-<id>.info` en la carpeta del juego: ejecutable principal.
//! - API pública v2 (`api.gog.com/v2/games/<id>`): portadas y detalles.
//!
//! Los juegos de GOG no tienen DRM: se ejecuta el `.exe` directamente, sin abrir Galaxy.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::{Connection, OpenFlags};
use serde::Deserialize;

use crate::models::{Game, GameDetails, GameSource, Platform};

#[derive(Debug, Clone, Default)]
pub struct GogGame {
    pub id: String,
    pub title: String,
    pub install_path: Option<PathBuf>,
    pub playtime_minutes: u64,
    /// ISO 8601 UTC.
    pub last_played: Option<String>,
}

fn program_data() -> PathBuf {
    std::env::var_os("ProgramData").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(r"C:\ProgramData"))
}

pub fn galaxy_db_path() -> Option<PathBuf> {
    let path = program_data().join(r"GOG.com\Galaxy\storage\galaxy-2.1.db");
    path.is_file().then_some(path)
}

fn is_numeric_id(id: &str) -> bool {
    !id.is_empty() && id.chars().all(|c| c.is_ascii_digit())
}

// ── Registro ────────────────────────────────────────────────────────────

/// Juegos instalados según el registro (id → (título, carpeta)).
pub fn registry_games() -> HashMap<String, (String, PathBuf)> {
    let mut out = HashMap::new();
    #[cfg(windows)]
    {
        use winreg::enums::{HKEY_LOCAL_MACHINE, KEY_READ};
        use winreg::RegKey;
        let Ok(games) = RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey_with_flags(r"SOFTWARE\WOW6432Node\GOG.com\Games", KEY_READ)
        else {
            return out;
        };
        for id in games.enum_keys().flatten() {
            let Ok(key) = games.open_subkey(&id) else { continue };
            let game_id: String = key.get_value("gameID").unwrap_or_else(|_| id.clone());
            let name: String = key.get_value("gameName").unwrap_or_default();
            let path: String = key.get_value("path").unwrap_or_default();
            if is_numeric_id(&game_id) && !name.is_empty() && !path.is_empty() {
                out.insert(game_id, (name, PathBuf::from(path)));
            }
        }
    }
    out
}

pub fn detected() -> bool {
    galaxy_db_path().is_some() || !registry_games().is_empty()
}

// ── Base de datos de Galaxy ─────────────────────────────────────────────

/// Lee la biblioteca de Galaxy desde una copia temporal de la base.
pub fn galaxy_games(db_path: &Path, scratch_dir: &Path) -> Vec<GogGame> {
    let copy = scratch_dir.join("galaxy-copy.db");
    if fs::create_dir_all(scratch_dir).is_err() || fs::copy(db_path, &copy).is_err() {
        return Vec::new();
    }
    let games = read_galaxy(&copy).unwrap_or_default();
    let _ = fs::remove_file(&copy);
    games
}

fn read_galaxy(path: &Path) -> rusqlite::Result<Vec<GogGame>> {
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX)?;

    // Títulos: GamePieces con tipo "title" → {"title": "..."}. Solo releases de GOG
    // (Galaxy también guarda juegos de otras tiendas si se integraron).
    let mut titles: HashMap<String, String> = HashMap::new();
    {
        let mut stmt = conn.prepare(
            "SELECT gp.releaseKey, gp.value FROM GamePieces gp
             JOIN GamePieceTypes t ON t.id = gp.gamePieceTypeId
             WHERE t.type = 'title' AND gp.releaseKey LIKE 'gog\\_%' ESCAPE '\\'",
        )?;
        let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
        for (key, value) in rows.flatten() {
            #[derive(Deserialize)]
            struct Title {
                title: Option<String>,
            }
            if let Some(title) = serde_json::from_str::<Title>(&value).ok().and_then(|t| t.title) {
                titles.insert(key, title);
            }
        }
    }

    // Solo lo que el usuario tiene en su biblioteca.
    let owned: Vec<String> = optional_rows(
        &conn,
        "SELECT DISTINCT releaseKey FROM LibraryReleases WHERE releaseKey LIKE 'gog\\_%' ESCAPE '\\'",
        |r| r.get::<_, String>(0),
    );
    let owned: Vec<String> = if owned.is_empty() { titles.keys().cloned().collect() } else { owned };

    let times: HashMap<String, u64> = optional_rows(&conn, "SELECT releaseKey, minutesInGame FROM GameTimes", |r| {
        Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?.max(0) as u64))
    })
    .into_iter()
    .collect();

    let last_played: HashMap<String, String> =
        optional_rows(&conn, "SELECT gameReleaseKey, lastPlayedDate FROM LastPlayedDates", |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
        })
        .into_iter()
        .collect();

    let installed: HashMap<String, PathBuf> =
        optional_rows(&conn, "SELECT productId, installationPath FROM InstalledBaseProducts", |r| {
            Ok((r.get::<_, i64>(0)?.to_string(), PathBuf::from(r.get::<_, String>(1)?)))
        })
        .into_iter()
        .collect();

    Ok(owned
        .into_iter()
        .filter_map(|key| {
            let id = key.strip_prefix("gog_")?.to_string();
            let title = titles.get(&key)?.clone();
            Some(GogGame {
                install_path: installed.get(&id).cloned(),
                playtime_minutes: times.get(&key).copied().unwrap_or(0),
                last_played: last_played.get(&key).and_then(|d| galaxy_date_to_iso(d)),
                id,
                title,
            })
        })
        .collect())
}

/// Ejecuta una consulta que puede fallar (tabla inexistente en otra versión de Galaxy).
fn optional_rows<T>(conn: &Connection, sql: &str, map: impl FnMut(&rusqlite::Row<'_>) -> rusqlite::Result<T>) -> Vec<T> {
    let Ok(mut stmt) = conn.prepare(sql) else { return Vec::new() };
    let Ok(rows) = stmt.query_map([], map) else { return Vec::new() };
    rows.flatten().collect()
}

/// Galaxy guarda fechas como `2024-05-01 18:30:00` (UTC).
fn galaxy_date_to_iso(date: &str) -> Option<String> {
    let date = date.trim();
    let valid = date.len() >= 19 && date.as_bytes()[4] == b'-' && date.as_bytes()[10] == b' ';
    valid.then(|| format!("{}T{}Z", &date[..10], &date[11..19]))
}

// ── Unión de fuentes locales ────────────────────────────────────────────

/// Combina Galaxy y el registro. Un juego del registro siempre cuenta como instalado.
pub fn local_games(scratch_dir: &Path) -> Vec<GogGame> {
    let mut by_id: HashMap<String, GogGame> = HashMap::new();
    if let Some(db) = galaxy_db_path() {
        for game in galaxy_games(&db, scratch_dir) {
            by_id.insert(game.id.clone(), game);
        }
    }
    for (id, (title, path)) in registry_games() {
        let entry = by_id.entry(id.clone()).or_insert_with(|| GogGame { id, title, ..Default::default() });
        entry.install_path = Some(path);
    }
    by_id.into_values().collect()
}

pub fn build_games(games: &[GogGame]) -> Vec<Game> {
    games
        .iter()
        .map(|g| Game {
            id: format!("gog-{}", g.id),
            title: g.title.clone(),
            sources: vec![GameSource {
                platform: Platform::Gog,
                external_id: g.id.clone(),
                installed: g.install_path.as_ref().is_some_and(|p| p.is_dir()),
                playtime_minutes: g.playtime_minutes,
                last_played: g.last_played.clone(),
            }],
        })
        .collect()
}

// ── Lanzamiento directo (sin Galaxy) ────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GogInfo {
    #[serde(default)]
    play_tasks: Vec<PlayTask>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlayTask {
    #[serde(default)]
    is_primary: bool,
    #[serde(default, rename = "type")]
    kind: String,
    #[serde(default)]
    path: String,
    #[serde(default)]
    arguments: String,
    #[serde(default)]
    working_dir: String,
}

#[derive(Debug, PartialEq)]
pub struct LaunchSpec {
    pub exe: PathBuf,
    pub args: Vec<String>,
    pub working_dir: PathBuf,
}

/// Ejecutable principal según `goggame-<id>.info` (playTask primaria de tipo archivo).
pub fn launch_spec(install_dir: &Path, id: &str) -> Option<LaunchSpec> {
    let info: GogInfo = serde_json::from_slice(&fs::read(install_dir.join(format!("goggame-{id}.info"))).ok()?).ok()?;
    let task = info
        .play_tasks
        .iter()
        .filter(|t| t.kind == "FileTask" && !t.path.is_empty())
        .max_by_key(|t| t.is_primary)?;
    let exe = install_dir.join(task.path.replace('/', "\\"));
    let working_dir = if task.working_dir.is_empty() {
        exe.parent().map(Path::to_path_buf).unwrap_or_else(|| install_dir.to_path_buf())
    } else {
        install_dir.join(task.working_dir.replace('/', "\\"))
    };
    Some(LaunchSpec { exe, args: split_args(&task.arguments), working_dir })
}

/// Separa argumentos respetando comillas dobles.
fn split_args(input: &str) -> Vec<String> {
    let mut args = Vec::new();
    let mut current = String::new();
    let mut quoted = false;
    for c in input.chars() {
        match c {
            '"' => quoted = !quoted,
            c if c.is_whitespace() && !quoted => {
                if !current.is_empty() {
                    args.push(std::mem::take(&mut current));
                }
            }
            c => current.push(c),
        }
    }
    if !current.is_empty() {
        args.push(current);
    }
    args
}

pub fn install_dir(id: &str) -> Option<PathBuf> {
    if let Some((_, path)) = registry_games().remove(id) {
        return Some(path);
    }
    galaxy_db_path()?;
    let scratch = std::env::temp_dir().join("lphoton-gog");
    local_games(&scratch).into_iter().find(|g| g.id == id).and_then(|g| g.install_path).filter(|p| p.is_dir())
}

pub fn launch(id: &str) -> Result<(), String> {
    if !is_numeric_id(id) {
        return Err("Identificador de juego de GOG inválido.".into());
    }
    let dir = install_dir(id).ok_or("Este juego de GOG no está instalado.")?;
    let spec = launch_spec(&dir, id).ok_or("No encontramos el ejecutable del juego (goggame-*.info).")?;
    std::process::Command::new(&spec.exe)
        .args(&spec.args)
        .current_dir(&spec.working_dir)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("No pudimos abrir el juego ({e})."))
}

// ── API pública v2 ──────────────────────────────────────────────────────

#[derive(Debug, Default, Deserialize)]
struct V2Game {
    #[serde(default)]
    description: Option<String>,
    #[serde(default, rename = "_links")]
    links: HashMap<String, serde_json::Value>,
    #[serde(default, rename = "_embedded")]
    embedded: serde_json::Value,
}

async fn fetch_v2(client: &reqwest::Client, id: &str) -> Result<V2Game, String> {
    if !is_numeric_id(id) {
        return Err("id inválido".into());
    }
    client
        .get(format!("https://api.gog.com/v2/games/{id}"))
        .query(&[("locale", "es-ES")])
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| e.without_url().to_string())?
        .json::<V2Game>()
        .await
        .map_err(|e| e.without_url().to_string())
}

/// URL de la portada vertical (`cover`) o del fondo (`hero`).
pub async fn image_url(client: &reqwest::Client, id: &str, hero: bool) -> Option<String> {
    let game = fetch_v2(client, id).await.ok()?;
    let keys: &[&str] = if hero { &["galaxyBackgroundImage", "backgroundImage"] } else { &["boxArtImage"] };
    keys.iter()
        .find_map(|k| game.links.get(*k)?.get("href")?.as_str().map(str::to_string))
        .filter(|url| url.starts_with("https://"))
}

pub async fn details(client: &reqwest::Client, id: &str) -> Result<GameDetails, String> {
    let game = fetch_v2(client, id).await?;
    let names = |key: &str| -> Option<String> {
        let items: Vec<String> = game.embedded[key]
            .as_array()?
            .iter()
            .filter_map(|v| v["name"].as_str().map(str::to_string))
            .take(3)
            .collect();
        (!items.is_empty()).then(|| items.join(" / "))
    };
    let release_year = game.embedded["product"]["globalReleaseDate"]
        .as_str()
        .and_then(|d| d.get(..4))
        .and_then(|y| y.parse().ok());
    Ok(GameDetails {
        description: game.description.as_deref().map(super::steam::clean_html).filter(|s| !s.is_empty()),
        genre: names("tags"),
        developer: names("developers"),
        release_year,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_galaxy_dates() {
        assert_eq!(galaxy_date_to_iso("2024-05-01 18:30:00").as_deref(), Some("2024-05-01T18:30:00Z"));
        assert!(galaxy_date_to_iso("ayer").is_none());
    }

    #[test]
    fn splits_quoted_arguments() {
        assert_eq!(split_args(r#"-a "b c"  d"#), vec!["-a", "b c", "d"]);
        assert!(split_args("").is_empty());
    }

    #[test]
    fn reads_synthetic_galaxy_db() {
        let dir = std::env::temp_dir().join(format!("lphoton-gog-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let db = dir.join("galaxy-2.1.db");
        {
            let conn = Connection::open(&db).unwrap();
            conn.execute_batch(
                r#"
                CREATE TABLE GamePieceTypes (id INTEGER PRIMARY KEY, type TEXT);
                CREATE TABLE GamePieces (releaseKey TEXT, gamePieceTypeId INTEGER, userId INTEGER, value TEXT);
                CREATE TABLE LibraryReleases (id INTEGER PRIMARY KEY, releaseKey TEXT, userId INTEGER);
                CREATE TABLE GameTimes (userId INTEGER, releaseKey TEXT, minutesInGame INTEGER);
                CREATE TABLE LastPlayedDates (userId INTEGER, gameReleaseKey TEXT, lastPlayedDate TEXT);
                CREATE TABLE InstalledBaseProducts (productId INTEGER, installationPath TEXT);
                INSERT INTO GamePieceTypes VALUES (1, 'title'), (2, 'originalImages');
                INSERT INTO GamePieces VALUES ('gog_1207658924', 1, 1, '{"title":"The Witcher"}'),
                                              ('steam_10', 1, 1, '{"title":"Steam integrado"}');
                INSERT INTO LibraryReleases (releaseKey, userId) VALUES ('gog_1207658924', 1), ('steam_10', 1);
                INSERT INTO GameTimes VALUES (1, 'gog_1207658924', 95);
                INSERT INTO LastPlayedDates VALUES (1, 'gog_1207658924', '2025-01-02 03:04:05');
                INSERT INTO InstalledBaseProducts VALUES (1207658924, 'C:\Games\Witcher');
                "#,
            )
            .unwrap();
        }
        let games = galaxy_games(&db, &dir.join("scratch"));
        assert_eq!(games.len(), 1, "solo releases gog_");
        let g = &games[0];
        assert_eq!((g.id.as_str(), g.title.as_str(), g.playtime_minutes), ("1207658924", "The Witcher", 95));
        assert_eq!(g.last_played.as_deref(), Some("2025-01-02T03:04:05Z"));
        assert_eq!(g.install_path.as_deref(), Some(Path::new(r"C:\Games\Witcher")));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn picks_primary_file_task() {
        let dir = std::env::temp_dir().join(format!("lphoton-gog-info-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        fs::write(
            dir.join("goggame-42.info"),
            r#"{"gameId":"42","playTasks":[
                {"type":"URLTask","link":"https://gog.com"},
                {"type":"FileTask","path":"tools/config.exe"},
                {"isPrimary":true,"type":"FileTask","path":"bin/game.exe","arguments":"-windowed \"x y\"","workingDir":"bin"}
            ]}"#,
        )
        .unwrap();
        let spec = launch_spec(&dir, "42").unwrap();
        assert_eq!(spec.exe, dir.join(r"bin\game.exe"));
        assert_eq!(spec.args, vec!["-windowed", "x y"]);
        assert_eq!(spec.working_dir, dir.join("bin"));
        let _ = fs::remove_dir_all(dir);
    }
}

/// Prueba manual con red: `cargo test real_gog_api -- --ignored --nocapture`.
#[cfg(test)]
mod real_api {
    #[test]
    #[ignore]
    fn real_gog_api() {
        let rt = tauri::async_runtime::block_on(async {
            let client = crate::library::steam::http_client();
            let d = super::details(&client, "1207658924").await;
            let cover = super::image_url(&client, "1207658924", false).await;
            let hero = super::image_url(&client, "1207658924", true).await;
            (d, cover, hero)
        });
        println!("{:#?}", rt);
        assert!(rt.1.is_some() && rt.2.is_some());
    }
}
