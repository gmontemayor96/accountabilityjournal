use tauri_plugin_sql::{Migration, MigrationKind};

/// Schema migrations, applied in order when the front end opens `identity.db`.
/// Add a new numbered file in `migrations/` and a new entry here for each schema change.
fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "initial schema",
        sql: include_str!("../migrations/001_init.sql"),
        kind: MigrationKind::Up,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:identity.db", migrations())
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running Identity");
}
