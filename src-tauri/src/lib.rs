mod data_files;
mod sync_files;

use tauri_plugin_sql::{Migration, MigrationKind};

/// Schema migrations, applied in order when the front end opens `identity.db`.
/// Add a new numbered file in `migrations/` and a new entry here for each schema change.
fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "initial schema",
            sql: include_str!("../migrations/001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "sync timestamps and tombstones",
            sql: include_str!("../migrations/002_sync.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "tasks",
            sql: include_str!("../migrations/003_tasks.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:identity.db", migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            sync_files::sync_read_peers,
            sync_files::sync_write_own,
            data_files::backup_write,
            data_files::backup_list,
            data_files::backup_read,
            data_files::export_write,
            data_files::import_read,
            data_files::import_candidates,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Identity");
}
