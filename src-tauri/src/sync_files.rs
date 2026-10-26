//! Reads and writes the sync files in the user's Syncthing folder. The front end decides what
//! goes in them; this side only touches files named `identity-sync-*.json` in that one folder.

use std::fs;
use std::path::Path;

const PREFIX: &str = "identity-sync-";
const SUFFIX: &str = ".json";

fn is_sync_file(name: &str) -> bool {
    name.starts_with(PREFIX) && name.ends_with(SUFFIX) && !name.contains('/') && !name.contains('\\')
}

fn describe(err: std::io::Error, folder: &str) -> String {
    match err.kind() {
        std::io::ErrorKind::PermissionDenied => format!("permission denied: {folder}"),
        std::io::ErrorKind::NotFound => format!("folder not found: {folder}"),
        _ => format!("{err} ({folder})"),
    }
}

/// Contents of every other device's sync file in `folder` (Syncthing conflict copies included;
/// merging an older copy changes nothing).
#[tauri::command]
pub fn sync_read_peers(folder: String, own_file: String) -> Result<Vec<String>, String> {
    let dir = fs::read_dir(&folder).map_err(|e| describe(e, &folder))?;
    let mut out = Vec::new();
    for item in dir.flatten() {
        let name = item.file_name().to_string_lossy().into_owned();
        if !is_sync_file(&name) || name == own_file {
            continue;
        }
        match fs::read_to_string(item.path()) {
            Ok(text) => out.push(text),
            Err(e) => eprintln!("sync: could not read {name}: {e}"),
        }
    }
    Ok(out)
}

/// Replaces this device's sync file in one step, so Syncthing never sends a half-written file.
#[tauri::command]
pub fn sync_write_own(folder: String, own_file: String, contents: String) -> Result<(), String> {
    if !is_sync_file(&own_file) {
        return Err(format!("not a sync file name: {own_file}"));
    }
    let dir = Path::new(&folder);
    let tmp = dir.join(format!(".{own_file}.tmp"));
    fs::write(&tmp, contents).map_err(|e| describe(e, &folder))?;
    fs::rename(&tmp, dir.join(&own_file)).map_err(|e| describe(e, &folder))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_then_reads_only_other_devices() {
        let dir = std::env::temp_dir().join(format!("identity-sync-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let folder = dir.to_string_lossy().into_owned();
        sync_write_own(folder.clone(), "identity-sync-a.json".into(), "A".into()).unwrap();
        sync_write_own(folder.clone(), "identity-sync-b.json".into(), "B".into()).unwrap();
        fs::write(dir.join("notes.txt"), "x").unwrap();
        assert_eq!(sync_read_peers(folder.clone(), "identity-sync-a.json".into()).unwrap(), vec!["B"]);
        assert!(sync_write_own(folder, "../evil.json".into(), "".into()).is_err());
        fs::remove_dir_all(dir).unwrap();
    }
}
