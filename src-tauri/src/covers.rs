//! Protocolo `cover://` para portadas y banners, con caché en disco.
//!
//! URL desde el frontend (Windows): `http://cover.localhost/steam/<appid>/<cover|hero>`.
//! Orden de búsqueda:
//!   1. Caché propia de LPhoton (`<app_cache_dir>/covers/`).
//!   2. Caché del cliente de Steam (`appcache/librarycache/`): sin red.
//!   3. CDN de Steam; la descarga se guarda en (1).
//! Si nada funciona responde 404 y el frontend muestra un placeholder.

use std::path::{Path, PathBuf};

use tauri::http::{header, Response, StatusCode};
use tauri::{Manager, Runtime, UriSchemeContext, UriSchemeResponder};

use crate::library::steam;
use crate::AppState;

const STEAM_CDN: &str = "https://cdn.cloudflare.steamstatic.com/steam/apps";

#[derive(Clone, Copy)]
enum Kind {
    Cover,
    Hero,
}

impl Kind {
    fn steam_file(self) -> &'static str {
        match self {
            Kind::Cover => "library_600x900.jpg",
            Kind::Hero => "library_hero.jpg",
        }
    }
}

fn parse(path: &str) -> Option<(u32, Kind)> {
    let mut parts = path.trim_matches('/').split('/');
    if parts.next()? != "steam" {
        return None;
    }
    let appid = parts.next()?.parse().ok()?;
    let kind = match parts.next()? {
        "cover" => Kind::Cover,
        "hero" => Kind::Hero,
        _ => return None,
    };
    parts.next().is_none().then_some((appid, kind))
}

pub fn handle<R: Runtime>(ctx: UriSchemeContext<'_, R>, request: tauri::http::Request<Vec<u8>>, responder: UriSchemeResponder) {
    let app = ctx.app_handle().clone();
    let path = request.uri().path().to_string();
    tauri::async_runtime::spawn(async move {
        let response = match parse(&path) {
            Some((appid, kind)) => {
                let state = app.state::<AppState>();
                match resolve(&state, appid, kind).await {
                    Some(bytes) => image(bytes),
                    None => status(StatusCode::NOT_FOUND),
                }
            }
            None => status(StatusCode::BAD_REQUEST),
        };
        responder.respond(response);
    });
}

async fn resolve(state: &AppState, appid: u32, kind: Kind) -> Option<Vec<u8>> {
    let cached = cache_path(&state.cache_dir, appid, kind);
    if let Ok(bytes) = tokio_read(&cached).await {
        return Some(bytes);
    }

    if let Some(root) = &state.steam_root {
        if let Some(local) = steam::local_library_image(root, appid, kind.steam_file()) {
            if let Ok(bytes) = tokio_read(&local).await {
                return Some(bytes);
            }
        }
    }

    let url = format!("{STEAM_CDN}/{appid}/{}", kind.steam_file());
    let resp = state.http.get(url).send().await.ok()?.error_for_status().ok()?;
    let is_image = resp
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|ct| ct.starts_with("image/"));
    if !is_image {
        return None;
    }
    let bytes = resp.bytes().await.ok()?.to_vec();
    let target = cached.clone();
    let data = bytes.clone();
    let _ = tauri::async_runtime::spawn_blocking(move || {
        if let Some(parent) = target.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        std::fs::write(target, data)
    })
    .await;
    Some(bytes)
}

fn cache_path(cache_dir: &Path, appid: u32, kind: Kind) -> PathBuf {
    let name = match kind {
        Kind::Cover => "cover",
        Kind::Hero => "hero",
    };
    cache_dir.join("covers").join(format!("steam_{appid}_{name}.jpg"))
}

async fn tokio_read(path: &Path) -> std::io::Result<Vec<u8>> {
    let path = path.to_path_buf();
    tauri::async_runtime::spawn_blocking(move || std::fs::read(path))
        .await
        .unwrap_or_else(|e| Err(std::io::Error::other(e.to_string())))
}

fn image(bytes: Vec<u8>) -> Response<Vec<u8>> {
    Response::builder()
        .header(header::CONTENT_TYPE, "image/jpeg")
        // Una semana: la caché del WebView evita volver a pedirla.
        .header(header::CACHE_CONTROL, "max-age=604800")
        .body(bytes)
        .unwrap_or_else(|_| status(StatusCode::INTERNAL_SERVER_ERROR))
}

fn status(code: StatusCode) -> Response<Vec<u8>> {
    let mut resp = Response::new(Vec::new());
    *resp.status_mut() = code;
    resp
}

#[cfg(test)]
mod tests {
    use super::parse;

    #[test]
    fn parses_cover_urls() {
        assert!(matches!(parse("/steam/2050650/cover"), Some((2_050_650, super::Kind::Cover))));
        assert!(matches!(parse("/steam/10/hero"), Some((10, super::Kind::Hero))));
        assert!(parse("/steam/abc/cover").is_none());
        assert!(parse("/steam/10/cover/../../x").is_none());
        assert!(parse("/epic/10/cover").is_none());
    }
}
