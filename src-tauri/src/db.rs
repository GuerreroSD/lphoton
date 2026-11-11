//! Caché SQLite de la biblioteca (RNF7).
//!
//! Al abrir LPhoton se muestra lo que hay aquí al instante; la sincronización
//! con Steam corre después, en segundo plano, y reemplaza el contenido.

use std::path::Path;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection, OptionalExtension};

use crate::community::{CommunityFix, FixKind, NewFix};
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
             );
             CREATE TABLE IF NOT EXISTS community_fixes (
                 id          INTEGER PRIMARY KEY AUTOINCREMENT,
                 game_id     TEXT NOT NULL,
                 kind        TEXT NOT NULL,
                 title       TEXT NOT NULL,
                 description TEXT NOT NULL,
                 url         TEXT,
                 votes       INTEGER NOT NULL DEFAULT 0,
                 created_at  INTEGER NOT NULL
             );
             CREATE INDEX IF NOT EXISTS community_fixes_game ON community_fixes (game_id);",
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

    // ── Comunidad (RF4) ────────────────────────────────────────────────

    /// Soluciones de un juego, de más a menos votadas (y las más nuevas primero si empatan).
    pub fn list_fixes(&self, game_id: &str) -> rusqlite::Result<Vec<CommunityFix>> {
        let conn = self.conn();
        let mut stmt = conn.prepare_cached(
            "SELECT id, game_id, kind, title, description, url, votes, created_at
             FROM community_fixes WHERE game_id = ?1
             ORDER BY votes DESC, created_at DESC, id DESC",
        )?;
        let rows = stmt.query_map(params![game_id], |r| {
            Ok(CommunityFix {
                id: r.get(0)?,
                game_id: r.get(1)?,
                kind: FixKind::parse(&r.get::<_, String>(2)?).unwrap_or(FixKind::Fix),
                title: r.get(3)?,
                description: r.get(4)?,
                url: r.get(5)?,
                votes: r.get(6)?,
                created_at: r.get(7)?,
            })
        })?;
        rows.collect()
    }

    /// Cantidad de soluciones por juego (para mostrarla en la lista de Foros).
    pub fn fix_counts(&self) -> rusqlite::Result<Vec<(String, i64)>> {
        let conn = self.conn();
        let mut stmt = conn.prepare_cached("SELECT game_id, COUNT(*) FROM community_fixes GROUP BY game_id")?;
        let rows = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?;
        rows.collect()
    }

    pub fn add_fix(&self, fix: &NewFix) -> rusqlite::Result<i64> {
        let conn = self.conn();
        conn.execute(
            "INSERT INTO community_fixes (game_id, kind, title, description, url, votes, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6)",
            params![fix.game_id, fix.kind.as_str(), fix.title, fix.description, fix.url, now()],
        )?;
        Ok(conn.last_insert_rowid())
    }

    /// Suma `delta` (+1 o -1) a los votos.
    pub fn vote_fix(&self, id: i64, delta: i64) -> rusqlite::Result<()> {
        self.conn().execute(
            "UPDATE community_fixes SET votes = votes + ?2 WHERE id = ?1",
            params![id, delta.signum()],
        )?;
        Ok(())
    }

    pub fn delete_fix(&self, id: i64) -> rusqlite::Result<()> {
        self.conn().execute("DELETE FROM community_fixes WHERE id = ?1", params![id])?;
        Ok(())
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

    #[test]
    fn community_fixes_sorted_by_votes() {
        let dir = std::env::temp_dir().join(format!("lphoton-fix-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let db = Db::open(&dir.join("t.db")).unwrap();
        let fix = |title: &str| NewFix {
            game_id: "steam-10".into(),
            kind: FixKind::Mod,
            title: title.into(),
            description: String::new(),
            url: None,
        };
        let a = db.add_fix(&fix("A")).unwrap();
        let b = db.add_fix(&fix("B")).unwrap();
        db.vote_fix(b, 1).unwrap();
        db.vote_fix(b, 5).unwrap(); // se normaliza a +1
        db.vote_fix(a, -1).unwrap();
        let list = db.list_fixes("steam-10").unwrap();
        assert_eq!(list.iter().map(|f| (f.title.as_str(), f.votes)).collect::<Vec<_>>(), vec![("B", 2), ("A", -1)]);
        assert_eq!(db.fix_counts().unwrap(), vec![("steam-10".to_string(), 2)]);
        db.delete_fix(a).unwrap();
        assert_eq!(db.list_fixes("steam-10").unwrap().len(), 1);
        drop(db);
        let _ = std::fs::remove_dir_all(dir);
    }
}
