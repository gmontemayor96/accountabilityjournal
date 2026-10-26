# Identity

A self-contained habit tracker for Windows and Android: habits you design yourself, logged on a calendar, with notes, tags and a daily journal. Each habit carries an identity statement ("I am a runner"), so you track who you are becoming.

All data stays on your devices in one SQLite file per device (`identity.db`, in `%APPDATA%\com.gmontemayor96.identity` on Windows). There is no account and nothing is sent anywhere. To keep a PC and a phone in step, point both at a folder that [Syncthing](https://syncthing.net) shares between them (see Sync below).

## Status

Milestones 1 and 2 of 4 (see the [product and architecture spec](https://claude.ai/code/artifact/4cf36a72-af15-4037-adef-5221456134f8)):

- [x] App shell, SQLite schema and migrations
- [x] Habit editor: name, identity statement, color, type (Yes/No, Count, Duration, Scale 1-5), schedule (every day, specific days, times per week), tags, extra fields
- [x] Today screen: log every habit type, per-entry notes and extra fields, journal, mood, day tags, day at a glance
- [x] Archive and restore habits
- [x] Calendar: month grid with a dot per habit, completion bar, day tags, journal marker, tag filter, per-habit heatmap, day summary
- [x] Journal: feed of every logged day with search across journal, notes and fields, and a tag filter
- [x] Tags: rename, recolor, delete, add
- [x] Android app, with a phone layout (bottom tabs)
- [x] Sync between devices through a Syncthing folder
- [ ] Streaks, backups, export/import (milestone 3)

## Install

Every push builds Windows installers on GitHub Actions. Open the latest run under **Actions → Build Windows app**, download **identity-windows-installers**, and run the `.msi` or `-setup.exe`.

On Android: open **Actions → Build Android app**, download **identity-android-apk**, unzip it on your phone and open the `.apk` (allow installing from your browser or file manager when asked).

APKs are signed with the keystore in the `ANDROID_KEYSTORE` (base64 of a `.jks` with key alias `identity`) and `ANDROID_KEYSTORE_PASSWORD` repository secrets, so a new APK installs over the old one. Without those secrets each build gets a one-off key, and updating means uninstalling first (sync brings your data back).

## Sync

1. In Syncthing, share one folder between your PC and phone (for example `Identity`).
2. In the app on each device, open **Sync**, choose that folder and press **Save**. On Android, type the folder path shown in Syncthing (such as `/storage/emulated/0/Syncthing/Identity`) and allow **All files access** when asked.

Each device writes its own `identity-sync-<device>.json` there and reads the others'. The SQLite file itself is never shared, so Syncthing can't corrupt it. Every habit, tag, day and entry carries the time it last changed; when two devices changed the same thing, the later change wins, and deletions travel as tombstones. Sync runs on start, when the app comes back into view, every minute while open, a few seconds after an edit, and from **Sync now**.

## Develop

Requirements: Node 22, Rust (stable), and on Windows the WebView2 runtime (built into Windows 10 and 11).

```sh
npm install
npm run tauri dev   # the desktop app, with your real local database
npm run dev         # the UI alone in a browser, with example habits (data stays in the browser)
npm test            # unit tests, including the SQL layer against a real SQLite database
npx tauri build     # Windows installers in src-tauri/target/release/bundle
npx tauri android build --apk   # needs the Android SDK and NDK (ANDROID_HOME, NDK_HOME)
```

## How it fits together

- `src/habitTypes/` — one module per habit type (input control, done rule, display). Register a new type in `index.ts` and it appears in the editor and on Today.
- `src/domain/` — the data model, local-date helpers and schedules.
- `src/data/` — the `Repo` interface; `SqliteRepo` for the app, `MemoryRepo` for the browser preview.
- `src/sync/` — sync: `merge.ts` decides which version of each record wins, `engine.ts` runs a round against the folder.
- `src/store.ts` — app state and actions (zustand).
- `src/screens/`, `src/components/` — the UI.
- `src-tauri/` — the Rust shell. `migrations/` holds numbered SQL files, registered in `src/lib.rs`; `src/sync_files.rs` reads and writes the sync files.
- `src-tauri/gen/android/` — the Android project. `MainActivity.kt` adds the All files access check the Sync screen uses.
