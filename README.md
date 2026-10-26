# Identity

A self-contained Windows habit tracker: habits you design yourself, logged on a calendar, with notes, tags and a daily journal. Each habit carries an identity statement ("I am a runner"), so you track who you are becoming.

All data stays on your PC in one SQLite file (`identity.db` in `%APPDATA%\com.gmontemayor96.identity`). There is no account and nothing is sent anywhere.

## Status

Milestone 1 of 4 (see the [product and architecture spec](https://claude.ai/code/artifact/4cf36a72-af15-4037-adef-5221456134f8)):

- [x] App shell, SQLite schema and migrations
- [x] Habit editor: name, identity statement, color, type (Yes/No, Count, Duration, Scale 1-5), schedule (every day, specific days, times per week), tags, extra fields
- [x] Today screen: log every habit type, per-entry notes and extra fields, journal, mood, day tags, day at a glance
- [x] Archive and restore habits
- [ ] Calendar, Journal feed, Tags screen (milestone 2)
- [ ] Streaks, backups, export/import (milestone 3)

## Install

Every push builds Windows installers on GitHub Actions. Open the latest run under **Actions → Build Windows app**, download **identity-windows-installers**, and run the `.msi` or `-setup.exe`.

## Develop

Requirements: Node 22, Rust (stable), and on Windows the WebView2 runtime (built into Windows 10 and 11).

```sh
npm install
npm run tauri dev   # the desktop app, with your real local database
npm run dev         # the UI alone in a browser, with example habits (data stays in the browser)
npm test            # unit tests, including the SQL layer against a real SQLite database
npx tauri build     # Windows installers in src-tauri/target/release/bundle
```

## How it fits together

- `src/habitTypes/` — one module per habit type (input control, done rule, display). Register a new type in `index.ts` and it appears in the editor and on Today.
- `src/domain/` — the data model, local-date helpers and schedules.
- `src/data/` — the `Repo` interface; `SqliteRepo` for the app, `MemoryRepo` for the browser preview.
- `src/store.ts` — app state and actions (zustand).
- `src/screens/`, `src/components/` — the UI.
- `src-tauri/` — the Rust shell. `migrations/` holds numbered SQL files, registered in `src/lib.rs`.
