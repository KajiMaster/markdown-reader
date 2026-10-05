use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

#[cfg(target_os = "linux")]
use tauri::Manager;

/// Returns the path passed on the command line (`md-read /path/file.md`), if any.
#[tauri::command]
fn get_argv() -> Option<String> {
    std::env::args().nth(1)
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(path, content).map_err(|e| e.to_string())
}

/// Finds the Claude Code CLI. Desktop launchers often start apps with a minimal PATH, so the
/// usual install locations are checked too.
fn find_claude() -> Option<PathBuf> {
    let names: &[&str] = if cfg!(windows) { &["claude.exe", "claude.cmd"] } else { &["claude"] };
    let mut dirs: Vec<PathBuf> = std::env::var_os("PATH")
        .map(|p| std::env::split_paths(&p).collect())
        .unwrap_or_default();
    if let Some(home) = std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")) {
        let home = PathBuf::from(home);
        for sub in [".local/bin", ".claude/local", ".npm-global/bin", "AppData/Roaming/npm"] {
            dirs.push(home.join(sub));
        }
    }
    dirs.extend(["/usr/local/bin", "/opt/homebrew/bin", "/usr/bin"].map(PathBuf::from));
    dirs.iter()
        .flat_map(|d| names.iter().map(move |n| d.join(n)))
        .find(|p| p.is_file())
}

const CLAUDE_TIMEOUT: Duration = Duration::from_secs(240);

/// Runs one headless Claude Code turn with every tool disabled, so Claude can only answer;
/// the app applies any edit itself. Uses the user's own Claude Code login.
fn run_claude(system: &str, prompt: &str) -> Result<String, String> {
    let claude = find_claude()
        .ok_or("Claude Code isn't installed (no `claude` command found).")?;
    let mut child = Command::new(claude)
        .args([
            "-p",
            "--output-format",
            "json",
            "--tools",
            "",
            "--no-session-persistence",
            "--strict-mcp-config",
            "--setting-sources",
            "",
            "--system-prompt",
            system,
        ])
        .current_dir(std::env::temp_dir())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Couldn't start Claude Code: {e}"))?;

    child
        .stdin
        .take()
        .ok_or("no stdin")?
        .write_all(prompt.as_bytes())
        .map_err(|e| e.to_string())?;

    // Drain both pipes on threads so a full pipe can never stall the child.
    let mut stdout = child.stdout.take().ok_or("no stdout")?;
    let mut stderr = child.stderr.take().ok_or("no stderr")?;
    let out = std::thread::spawn(move || {
        let mut s = String::new();
        let _ = stdout.read_to_string(&mut s);
        s
    });
    let err = std::thread::spawn(move || {
        let mut s = String::new();
        let _ = stderr.read_to_string(&mut s);
        s
    });

    let started = Instant::now();
    let status = loop {
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            break status;
        }
        if started.elapsed() > CLAUDE_TIMEOUT {
            let _ = child.kill();
            return Err("Claude took too long to answer.".into());
        }
        std::thread::sleep(Duration::from_millis(100));
    };
    let out = out.join().unwrap_or_default();
    let err = err.join().unwrap_or_default();

    let json: serde_json::Value = serde_json::from_str(out.trim()).map_err(|_| {
        let detail = if err.trim().is_empty() { out.trim() } else { err.trim() };
        format!("Claude Code failed ({status}): {}", detail.lines().last().unwrap_or(""))
    })?;
    let result = json["result"].as_str().unwrap_or_default().to_string();
    if json["is_error"].as_bool().unwrap_or(false) {
        return Err(format!("Claude Code error: {result}"));
    }
    Ok(result)
}

#[tauri::command]
async fn ask_claude(system: String, prompt: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || run_claude(&system, &prompt))
        .await
        .map_err(|e| e.to_string())?
}

/// On Wayland, tao draws its own GTK header bar and sets its label once at startup, so later
/// title changes reach the compositor but not the visible bar. Keep the bar's label in sync.
#[cfg(target_os = "linux")]
fn sync_header_title(window: &tauri::WebviewWindow) {
    use gtk::prelude::*;
    let Ok(gtk_window) = window.gtk_window() else { return };
    let header = gtk_window
        .titlebar()
        .and_then(|bar| bar.downcast::<gtk::Bin>().ok())
        .and_then(|bin| bin.child())
        .and_then(|child| child.downcast::<gtk::HeaderBar>().ok());
    if let Some(header) = header {
        gtk_window.connect_title_notify(move |w| header.set_title(w.title().as_deref()));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|_app| {
            #[cfg(target_os = "linux")]
            if let Some(window) = _app.get_webview_window("main") {
                sync_header_title(&window);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_argv, read_file, write_file, ask_claude])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
