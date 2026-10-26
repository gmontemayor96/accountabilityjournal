//! Google sign-in for the desktop app: opens the user's browser on Google's consent page and
//! catches the redirect on a one-off local port (OAuth "loopback" flow). The front end builds the
//! consent URL (with PKCE) and exchanges the code for tokens itself.

use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::time::{Duration, Instant};

#[derive(serde::Serialize)]
pub struct OAuthRedirect {
    redirect_uri: String,
    query: String,
}

fn open_browser(url: &str) -> std::io::Result<()> {
    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut c = std::process::Command::new("rundll32");
        c.args(["url.dll,FileProtocolHandler", url]);
        c
    };
    #[cfg(target_os = "macos")]
    let mut cmd = {
        let mut c = std::process::Command::new("open");
        c.arg(url);
        c
    };
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let mut cmd = {
        let mut c = std::process::Command::new("xdg-open");
        c.arg(url);
        c
    };
    cmd.spawn().map(|_| ())
}

/// Opens `auth_url` (with `{redirect}` in place of the redirect URI) and waits up to five minutes
/// for Google to send the browser back. Returns the redirect URI used and the query string.
#[tauri::command]
pub async fn google_oauth(auth_url: String) -> Result<OAuthRedirect, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
        let redirect_uri = format!(
            "http://127.0.0.1:{}",
            listener.local_addr().map_err(|e| e.to_string())?.port()
        );
        let encoded: String = redirect_uri
            .bytes()
            .map(|b| match b {
                b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'.' | b'-' | b'_' => {
                    (b as char).to_string()
                }
                _ => format!("%{b:02X}"),
            })
            .collect();
        open_browser(&auth_url.replace("{redirect}", &encoded))
            .map_err(|e| format!("could not open the browser: {e}"))?;

        wait_for_redirect(&listener, redirect_uri, Duration::from_secs(300))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Serves the browser's redirect on `listener` and returns its query string.
fn wait_for_redirect(
    listener: &TcpListener,
    redirect_uri: String,
    timeout: Duration,
) -> Result<OAuthRedirect, String> {
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let deadline = Instant::now() + timeout;
    loop {
        match listener.accept() {
            Ok((mut stream, _)) => {
                stream.set_nonblocking(false).ok();
                let mut line = String::new();
                BufReader::new(&stream)
                    .read_line(&mut line)
                    .map_err(|e| e.to_string())?;
                // "GET /?code=...&state=... HTTP/1.1"
                let path = line.split_whitespace().nth(1).unwrap_or("");
                let Some(query) = path.split_once('?').map(|(_, q)| q.to_string()) else {
                    let _ =
                        stream.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n");
                    continue; // e.g. a favicon request
                };
                let body = "<!doctype html><meta charset=utf-8><title>Identity</title>\
            <body style=\"font-family:system-ui;padding:40px\"><h2>Signed in to Google</h2>\
            <p>You can close this tab and go back to Identity.</p>";
                let _ = write!(stream, "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len());
                return Ok(OAuthRedirect {
                    redirect_uri,
                    query,
                });
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                if Instant::now() > deadline {
                    return Err("sign-in timed out".into());
                }
                std::thread::sleep(Duration::from_millis(150));
            }
            Err(e) => return Err(e.to_string()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn returns_the_redirect_query_and_skips_other_requests() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let client = std::thread::spawn(move || {
            for path in ["/favicon.ico", "/?code=abc&state=xyz"] {
                let mut s = std::net::TcpStream::connect(addr).unwrap();
                write!(s, "GET {path} HTTP/1.1\r\nHost: x\r\n\r\n").unwrap();
                let mut out = String::new();
                let _ = std::io::Read::read_to_string(&mut s, &mut out);
            }
        });
        let got = wait_for_redirect(&listener, "http://x".into(), Duration::from_secs(5)).unwrap();
        assert_eq!(got.query, "code=abc&state=xyz");
        client.join().unwrap();
    }
}
