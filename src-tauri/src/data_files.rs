//! Backups in the app's own data folder, and export/import files in a folder the user picked.

use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

fn backup_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("backups");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn plain_name(name: &str) -> Result<&str, String> {
    if name.is_empty() || name.contains(['/', '\\']) || name.starts_with('.') {
        return Err(format!("not a plain file name: {name}"));
    }
    Ok(name)
}

/// Writes `identity-backup-<date>.json` and keeps only the newest `keep` backups.
#[tauri::command]
pub fn backup_write(app: tauri::AppHandle, name: String, contents: String, keep: usize) -> Result<String, String> {
    let dir = backup_dir(&app)?;
    write_atomic(&dir, plain_name(&name)?, &contents)?;
    prune(&dir, keep);
    Ok(dir.to_string_lossy().into_owned())
}

fn prune(dir: &Path, keep: usize) {
    let mut names = list_backups(dir);
    names.sort();
    let extra = names.len().saturating_sub(keep);
    for name in names.into_iter().take(extra) {
        let _ = fs::remove_file(dir.join(name));
    }
}

fn list_backups(dir: &Path) -> Vec<String> {
    fs::read_dir(dir)
        .map(|it| {
            it.flatten()
                .map(|e| e.file_name().to_string_lossy().into_owned())
                .filter(|n| n.starts_with("identity-backup-") && n.ends_with(".json"))
                .collect()
        })
        .unwrap_or_default()
}

/// Backup file names, newest first, and the folder they live in.
#[tauri::command]
pub fn backup_list(app: tauri::AppHandle) -> Result<(String, Vec<String>), String> {
    let dir = backup_dir(&app)?;
    let mut names = list_backups(&dir);
    names.sort_by(|a, b| b.cmp(a));
    Ok((dir.to_string_lossy().into_owned(), names))
}

#[tauri::command]
pub fn backup_read(app: tauri::AppHandle, name: String) -> Result<String, String> {
    fs::read_to_string(backup_dir(&app)?.join(plain_name(&name)?)).map_err(|e| e.to_string())
}

fn write_atomic(dir: &Path, name: &str, contents: &str) -> Result<(), String> {
    let tmp = dir.join(format!(".{name}.tmp"));
    fs::write(&tmp, contents).map_err(|e| format!("{e} ({})", dir.display()))?;
    fs::rename(&tmp, dir.join(name)).map_err(|e| format!("{e} ({})", dir.display()))
}

/// Writes an export file into a folder the user chose.
#[tauri::command]
pub fn export_write(folder: String, name: String, contents: String) -> Result<String, String> {
    let dir = Path::new(&folder);
    write_atomic(dir, plain_name(&name)?, &contents)?;
    Ok(dir.join(name).to_string_lossy().into_owned())
}

/// Reads a file the user chose to import.
#[tauri::command]
pub fn import_read(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("{e} ({path})"))
}

/// JSON files in a folder whose name mentions Identity, newest name first (Android's import list).
#[tauri::command]
pub fn import_candidates(folder: String) -> Result<Vec<String>, String> {
    let mut names: Vec<String> = fs::read_dir(&folder)
        .map_err(|e| format!("{e} ({folder})"))?
        .flatten()
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .filter(|n| n.starts_with("identity-") && n.ends_with(".json"))
        .collect();
    names.sort_by(|a, b| b.cmp(a));
    Ok(names)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prunes_oldest_backups() {
        let dir = std::env::temp_dir().join(format!("identity-backup-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        for d in ["2026-10-01", "2026-10-02", "2026-10-03"] {
            write_atomic(&dir, &format!("identity-backup-{d}.json"), "{}").unwrap();
        }
        prune(&dir, 2);
        let mut left = list_backups(&dir);
        left.sort();
        assert_eq!(left, vec!["identity-backup-2026-10-02.json", "identity-backup-2026-10-03.json"]);
        assert!(plain_name("../x.json").is_err());
        fs::remove_dir_all(dir).unwrap();
    }
}
