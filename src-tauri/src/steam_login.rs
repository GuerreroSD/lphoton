//! "Iniciar sesión con Steam" (OpenID 2.0), sin servidor propio.
//!
//! 1. Se abre un puerto local (127.0.0.1, puerto libre al azar) y el navegador del
//!    sistema va a la página oficial de inicio de sesión de Steam.
//! 2. Steam redirige al puerto local con la respuesta firmada.
//! 3. LPhoton le pregunta a Steam si esa respuesta es auténtica
//!    (`check_authentication`) y recién ahí acepta el SteamID.
//!
//! La contraseña nunca pasa por LPhoton: se escribe en steamcommunity.com.

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use base64::Engine;
use serde::Serialize;

const OPENID_ENDPOINT: &str = "https://steamcommunity.com/openid/login";
const CLAIMED_ID_PREFIX: &str = "https://steamcommunity.com/openid/id/";
const OPENID_NS: &str = "http://specs.openid.net/auth/2.0";
const IDENTIFIER_SELECT: &str = "http://specs.openid.net/auth/2.0/identifier_select";
const CALLBACK_PATH: &str = "/steam-callback";
/// Tiempo para completar el inicio de sesión en el navegador.
const LOGIN_TIMEOUT: Duration = Duration::from_secs(300);

/// Cada intento tiene un número: uno nuevo (o cancelar) detiene el anterior.
static ATTEMPT: AtomicU64 = AtomicU64::new(0);

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SteamAccount {
    pub steam_id: String,
    pub name: String,
    /// Avatar como data URL (no depende de la red ni de la CSP para mostrarse).
    pub avatar: Option<String>,
}

/// Inicio de sesión que espera la redirección de Steam en un puerto local.
pub struct PendingLogin {
    listener: TcpListener,
    attempt: u64,
    pub return_to: String,
    pub login_url: String,
}

pub fn cancel() {
    ATTEMPT.fetch_add(1, Ordering::SeqCst);
}

/// Abre el puerto local y arma la URL de Steam.
pub fn prepare() -> Result<PendingLogin, String> {
    let attempt = ATTEMPT.fetch_add(1, Ordering::SeqCst) + 1;
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| format!("No se pudo abrir el inicio de sesión: {e}"))?;
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let realm = format!("http://127.0.0.1:{port}/");
    // Valor aleatorio: la respuesta solo vale para este intento.
    let return_to = format!("http://127.0.0.1:{port}{CALLBACK_PATH}?state={}", random_state());
    let login_url = url::Url::parse_with_params(
        OPENID_ENDPOINT,
        &[
            ("openid.ns", OPENID_NS),
            ("openid.mode", "checkid_setup"),
            ("openid.return_to", return_to.as_str()),
            ("openid.realm", realm.as_str()),
            ("openid.identity", IDENTIFIER_SELECT),
            ("openid.claimed_id", IDENTIFIER_SELECT),
        ],
    )
    .map_err(|e| e.to_string())?
    .to_string();
    Ok(PendingLogin { listener, attempt, return_to, login_url })
}

fn random_state() -> String {
    // Sin dependencia extra: mezcla de reloj, PID y una dirección de pila, en hexadecimal.
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    let local = 0u8;
    let mixed = nanos ^ (u128::from(std::process::id()) << 64) ^ (&local as *const u8 as usize as u128);
    let mut h = std::collections::hash_map::DefaultHasher::new();
    std::hash::Hash::hash(&mixed, &mut h);
    let a = std::hash::Hasher::finish(&h);
    std::hash::Hash::hash(&a, &mut h);
    format!("{:016x}{:016x}", a, std::hash::Hasher::finish(&h))
}

/// Espera (bloqueando) la redirección de Steam. Devuelve la conexión del
/// navegador, para responderle después de verificar, y los parámetros recibidos.
pub fn wait_for_callback(pending: &PendingLogin) -> Result<(TcpStream, Vec<(String, String)>), String> {
    let deadline = Instant::now() + LOGIN_TIMEOUT;
    loop {
        if ATTEMPT.load(Ordering::SeqCst) != pending.attempt {
            return Err("cancelado".into());
        }
        if Instant::now() > deadline {
            return Err("Se acabó el tiempo para iniciar sesión. Intenta de nuevo.".into());
        }
        match pending.listener.accept() {
            Ok((mut stream, _)) => {
                let _ = stream.set_nonblocking(false);
                let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
                let Some(target) = read_request_target(&mut stream) else { continue };
                if !target.starts_with(CALLBACK_PATH) {
                    // favicon.ico u otras peticiones del navegador.
                    respond(&mut stream, 404, "");
                    continue;
                }
                let Ok(url) = url::Url::parse(&format!("http://127.0.0.1{target}")) else {
                    respond(&mut stream, 400, &page(false, "La respuesta de Steam no es válida."));
                    continue;
                };
                let params = url.query_pairs().map(|(k, v)| (k.into_owned(), v.into_owned())).collect();
                return Ok((stream, params));
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => std::thread::sleep(Duration::from_millis(120)),
            Err(e) => return Err(e.to_string()),
        }
    }
}

fn read_request_target(stream: &mut TcpStream) -> Option<String> {
    let mut buf = Vec::with_capacity(4096);
    let mut chunk = [0u8; 2048];
    while !buf.windows(4).any(|w| w == b"\r\n\r\n") && buf.len() < 64 * 1024 {
        let n = stream.read(&mut chunk).ok()?;
        if n == 0 {
            break;
        }
        buf.extend_from_slice(&chunk[..n]);
    }
    let text = String::from_utf8_lossy(&buf);
    let mut parts = text.lines().next()?.split_whitespace();
    (parts.next()? == "GET").then(|| parts.next().map(str::to_string)).flatten()
}

/// Comprueba la respuesta con Steam y devuelve el SteamID64 verificado.
pub async fn verify(client: &reqwest::Client, params: &[(String, String)], return_to: &str) -> Result<u64, String> {
    let get = |key: &str| params.iter().find(|(k, _)| k == key).map(|(_, v)| v.as_str());
    match get("openid.mode") {
        Some("id_res") => {}
        Some("cancel") => return Err("Cancelaste el inicio de sesión en Steam.".into()),
        _ => return Err("Steam no confirmó el inicio de sesión.".into()),
    }
    if get("openid.op_endpoint") != Some(OPENID_ENDPOINT) || get("openid.return_to") != Some(return_to) {
        return Err("La respuesta no corresponde a este inicio de sesión.".into());
    }
    let claimed = get("openid.claimed_id").ok_or("Steam no envió la cuenta.")?;
    if get("openid.identity") != Some(claimed) {
        return Err("La respuesta de Steam no es válida.".into());
    }
    let steam_id = claimed
        .strip_prefix(CLAIMED_ID_PREFIX)
        .filter(|id| id.len() == 17 && id.bytes().all(|b| b.is_ascii_digit()))
        .and_then(|id| id.parse::<u64>().ok())
        .ok_or("La cuenta de Steam no es válida.")?;

    // Se reenvían los mismos parámetros firmados, cambiando solo el modo.
    let body = {
        let mut form = url::form_urlencoded::Serializer::new(String::new());
        for (k, v) in params.iter().filter(|(k, _)| k.starts_with("openid.") && k != "openid.mode") {
            form.append_pair(k, v);
        }
        form.append_pair("openid.mode", "check_authentication");
        form.finish()
    };
    let text = client
        .post(OPENID_ENDPOINT)
        .header(reqwest::header::CONTENT_TYPE, "application/x-www-form-urlencoded")
        .body(body)
        .send()
        .await
        .map_err(|e| format!("No pudimos contactar a Steam: {e}"))?
        .text()
        .await
        .map_err(|e| e.to_string())?;
    if text.lines().any(|l| l.trim() == "is_valid:true") {
        Ok(steam_id)
    } else {
        Err("Steam no pudo verificar el inicio de sesión. Intenta de nuevo.".into())
    }
}

/// Nombre y avatar públicos de la cuenta (perfil en XML, no necesita API key).
pub async fn profile(client: &reqwest::Client, steam_id: u64) -> SteamAccount {
    let fallback = SteamAccount { steam_id: steam_id.to_string(), name: "Jugador de Steam".into(), avatar: None };
    let Ok(resp) = client.get(format!("https://steamcommunity.com/profiles/{steam_id}/?xml=1")).send().await else {
        return fallback;
    };
    let Ok(xml) = resp.text().await else { return fallback };
    let name = xml_field(&xml, "steamID").filter(|n| !n.trim().is_empty()).map(|n| n.trim().to_string());
    let avatar_url = xml_field(&xml, "avatarFull").filter(|u| u.starts_with("https://"));
    let avatar = match avatar_url {
        Some(url) => avatar_data_url(client, &url).await,
        None => None,
    };
    SteamAccount { name: name.unwrap_or(fallback.name), avatar, ..fallback }
}

fn xml_field(xml: &str, tag: &str) -> Option<String> {
    let start = xml.find(&format!("<{tag}>"))? + tag.len() + 2;
    let end = start + xml[start..].find(&format!("</{tag}>"))?;
    let raw = xml[start..end].trim();
    let value = raw.strip_prefix("<![CDATA[").and_then(|v| v.strip_suffix("]]>")).unwrap_or(raw);
    Some(value.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&#39;", "'"))
}

async fn avatar_data_url(client: &reqwest::Client, url: &str) -> Option<String> {
    let resp = client.get(url).send().await.ok()?.error_for_status().ok()?;
    let mime = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .filter(|m| m.starts_with("image/"))
        .unwrap_or("image/jpeg")
        .to_string();
    let bytes = resp.bytes().await.ok()?;
    if bytes.len() > 512 * 1024 {
        return None;
    }
    Some(format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(&bytes)))
}

/// Página que ve el navegador al volver de Steam.
pub fn page(ok: bool, detail: &str) -> String {
    let (title, text) = if ok {
        ("Listo", "Iniciaste sesión con Steam. Ya puedes volver a LPhoton y cerrar esta pestaña.")
    } else {
        ("No se pudo iniciar sesión", detail)
    };
    let accent = if ok { "#00F0FF" } else { "#FF007F" };
    format!(
        "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\"><title>LPhoton · {title}</title>\
         <style>body{{margin:0;min-height:100vh;display:grid;place-items:center;background:#06070D;\
         color:#EEF1F8;font-family:Segoe UI,system-ui,sans-serif}}main{{max-width:420px;padding:32px;\
         border-radius:18px;background:#12131C;box-shadow:inset 0 0 0 1px rgba(238,241,248,.1)}}\
         h1{{margin:0 0 12px;font-size:22px;color:{accent}}}p{{margin:0;line-height:1.5;color:#DBC5DD}}</style>\
         </head><body><main><h1>{title}</h1><p>{text}</p></main></body></html>",
        text = html_escape(text),
    )
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
}

pub fn respond(stream: &mut TcpStream, status: u16, body: &str) {
    let reason = match status {
        200 => "OK",
        400 => "Bad Request",
        _ => "Not Found",
    };
    let _ = write!(
        stream,
        "HTTP/1.1 {status} {reason}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\n\
         Cache-Control: no-store\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.flush();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lee_campos_del_perfil_xml() {
        let xml = "<profile><steamID64>76561198000000000</steamID64><steamID><![CDATA[Leon & Co]]></steamID>\
                   <avatarFull><![CDATA[https://avatars.steamstatic.com/abc_full.jpg]]></avatarFull></profile>";
        assert_eq!(xml_field(xml, "steamID").as_deref(), Some("Leon & Co"));
        assert_eq!(xml_field(xml, "avatarFull").as_deref(), Some("https://avatars.steamstatic.com/abc_full.jpg"));
        assert_eq!(xml_field(xml, "missing"), None);
    }

    #[test]
    fn la_url_de_steam_lleva_el_regreso_local() {
        let pending = prepare().unwrap();
        assert!(pending.login_url.starts_with(OPENID_ENDPOINT));
        assert!(pending.return_to.starts_with("http://127.0.0.1:"));
        let url = url::Url::parse(&pending.login_url).unwrap();
        let return_to = url.query_pairs().find(|(k, _)| k == "openid.return_to").unwrap().1.into_owned();
        assert_eq!(return_to, pending.return_to);
        cancel();
    }

    fn params(return_to: &str, claimed: &str) -> Vec<(String, String)> {
        [
            ("openid.mode", "id_res"),
            ("openid.op_endpoint", OPENID_ENDPOINT),
            ("openid.return_to", return_to),
            ("openid.claimed_id", claimed),
            ("openid.identity", claimed),
        ]
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect()
    }

    // Estos casos se rechazan antes de consultar a Steam (no usan la red).
    #[test]
    fn rechaza_respuestas_de_otro_intento_o_cuenta_invalida() {
        let client = reqwest::Client::new();
        let ok_id = "https://steamcommunity.com/openid/id/76561198000000000";
        let here = "http://127.0.0.1:5000/steam-callback?state=a";
        let other = params("http://127.0.0.1:5000/steam-callback?state=b", ok_id);
        assert!(tauri::async_runtime::block_on(verify(&client, &other, here)).is_err());
        let bad_id = params(here, "https://evil.example/openid/id/76561198000000000");
        assert!(tauri::async_runtime::block_on(verify(&client, &bad_id, here)).is_err());
        let mut cancelled = params(here, ok_id);
        cancelled[0].1 = "cancel".into();
        assert!(tauri::async_runtime::block_on(verify(&client, &cancelled, here)).is_err());
    }
}
