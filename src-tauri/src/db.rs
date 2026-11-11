//! Caché SQLite de la biblioteca (RNF7).
//!
//! Al abrir LPhoton se muestra lo que hay aquí al instante; la sincronización
//! con Steam corre después, en segundo plano, y reemplaza el contenido.

use std::path::Path;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection, OptionalExtension};

use crate::models::{Game, GameDetails};

/// Los detalles de la tienda cambian poco: se refrescan cada 30 días.
const DETAILS_TTL_SECS: i64 = 30 * 24 * 3600;

pub struct Db(Mutex<Connection>);

fn now() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0)
}

impl Db {
    pub fn open(path: &Path) -> rusqlite::Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             CREATE TABLE IF NOT EXISTS games (
                 id         TEXT PRIMARY KEY,
                 data       TEXT NOT NULL,
                 updated_at INTEGER NOT NULL
             );
             CREATE TABLE IF NOT EXISTS game_details (
                 id         TEXT PRIMARY KEY,
                 data       TEXT NOT NULL,
                 fetched_at INTEGER NOT NULL
             );
             CREATE TABLE IF NOT EXISTS meta (
                 key   TEXT PRIMARY KEY,
                 value TEXT NOT NULL
             );",
        )?;
        Ok(Db(Mutex::new(conn)))
    }

    fn conn(&self) -> std::sync::MutexGuard<'_, Connection> {
        // Si un hilo entró en pánico con el lock tomado, la conexión sigue siendo válida.
        self.0.lock().unwrap_or_else(|e| e.into_inner())
    }

    pub fn load_games(&self) -> rusqlite::Result<Vec<Game>> {
        let conn = self.conn();
        let mut stmt = conn.prepare_cached("SELECT data FROM games")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        Ok(rows.filter_map(|r| r.ok()).filter_map(|json| serde_json::from_str(&json).ok()).collect())
    }

    /// Reemplaza toda la biblioteca en una transacción.
    pub fn replace_games(&self, games: &[Game]) -> rusqlite::Result<()> {
        let mut conn = self.conn();
        let tx = conn.transaction()?;
        tx.execute("DELETE FROM games", [])?;
        {
            let mut insert = tx.prepare_cached("INSERT INTO games (id, data, updated_at) VALUES (?1, ?2, ?3)")?;
            let ts = now();
            for game in games {
                let json = serde_json::to_string(game).unwrap_or_default();
                insert.execute(params![game.id, json, ts])?;
            }
        }
        tx.execute(
            "INSERT INTO meta (key, value) VALUES ('last_sync', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![now().to_string()],
        )?;
        tx.commit()
    }

    /// Detalles en caché, si no están vencidos.
    pub fn get_details(&self, id: &str) -> rusqlite::Result<Option<GameDetails>> {
        let conn = self.conn();
        let row: Option<(String, i64)> = conn
            .query_row(
                "SELECT data, fetched_at FROM game_details WHERE id = ?1",
                params![id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()?;
        Ok(row
            .filter(|(_, fetched)| now() - fetched < DETAILS_TTL_SECS)
            .and_then(|(json, _)| serde_json::from_str(&json).ok()))
    }

    pub fn get_meta(&self, key: &str) -> Option<String> {
        self.conn()
            .query_row("SELECT value FROM meta WHERE key = ?1", params![key], |r| r.get(0))
            .optional()
            .ok()
            .flatten()
    }

    pub fn set_meta(&self, key: &str, value: &str) -> rusqlite::Result<()> {
        self.conn().execute(
            "INSERT INTO meta (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }

    /// Procesos modificados por el modo ligero que aún no se restauran. Se guardan
    /// para poder restaurarlos aunque LPhoton se cierre de golpe.
    pub fn save_pending_lightmode(&self, adjusted: &[crate::lightmode::Adjusted]) {
        let json = serde_json::to_string(adjusted).unwrap_or_else(|_| "[]".into());
        let _ = self.set_meta("lightmode_pending", &json);
    }

    pub fn take_pending_lightmode(&self) -> Vec<crate::lightmode::Adjusted> {
        let pending = self
            .get_meta("lightmode_pending")
            .and_then(|json| serde_json::from_str(&json).ok())
            .unwrap_or_default();
        let _ = self.set_meta("lightmode_pending", "[]");
        pending
    }

    /// Procesos objetivo del modo ligero (configurables; por defecto los webhelpers).
    pub fn lightmode_targets(&self) -> Vec<String> {
        self.get_meta("lightmode_targets")
            .and_then(|json| serde_json::from_str::<Vec<String>>(&json).ok())
            .filter(|list| !list.is_empty())
            .unwrap_or_else(|| crate::lightmode::DEFAULT_TARGETS.iter().map(|s| s.to_string()).collect())
    }

    pub fn save_details(&self, id: &str, details: &GameDetails) -> rusqlite::Result<()> {
        let json = serde_json::to_string(details).unwrap_or_default();
        self.conn().execute(
            "INSERT INTO game_details (id, data, fetched_at) VALUES (?1, ?2, ?3)
             ON CONFLICT(id) DO UPDATE SET data = excluded.data, fetched_at = excluded.fetched_at",
            params![id, json, now()],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{GameSource, Platform};

    #[test]
    fn roundtrips_games_and_details() {
        let dir = std::env::temp_dir().join(format!("lphoton-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let db = Db::open(&dir.join("t.db")).unwrap();
        let game = Game {
            id: "steam-10".into(),
            title: "Juego".into(),
            sources: vec![GameSource {
                platform: Platform::Steam,
                external_id: "10".into(),
                installed: true,
                playtime_minutes: 5,
                last_played: None,
            }],
        };
        db.replace_games(std::slice::from_ref(&game)).unwrap();
        db.replace_games(std::slice::from_ref(&game)).unwrap();
        assert_eq!(db.load_games().unwrap().len(), 1);

        let details = GameDetails { genre: Some("Acción".into()), ..Default::default() };
        db.save_details("steam-10", &details).unwrap();
        assert_eq!(db.get_details("steam-10").unwrap().unwrap().genre.as_deref(), Some("Acción"));
        drop(db);
        let _ = std::fs::remove_dir_all(dir);
    }
}
