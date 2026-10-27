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
- [x] Streaks: current and best, on Today and Habits (per-week habits count weeks)
- [x] Daily automatic backups (last 30 kept), restore from any of them
- [x] Export to JSON (re-importable) and CSV (habit log and journal), import JSON
- [x] Android home-screen widgets: Today (tick habits and tasks) and Goals
- [x] Goals: areas of life with 1 day to 10 year goals, subgoals, linked tasks and progress
- [x] Google Calendar: dated tasks go to an "Identity" calendar; your Google events show (read-only) on Today and the calendar
- [x] Tasks: one-off to-dos with a due date and time, tags, notes and a reminder; shown on Today and the calendar, synced
- [x] Notifications: reminder times on habits and tasks, an on/off switch per device, and a default reminder for new tasks

## Install

Every push builds Windows installers on GitHub Actions. Open the latest run under **Actions → Build Windows app**, download **identity-windows-installers**, and run the `.msi` or `-setup.exe`.

On Android: open **Actions → Build Android app**, download **identity-android-apk**, unzip it on your phone and open the `.apk` (allow installing from your browser or file manager when asked).

### Signing the Android app (so updates install over the old version)

Android only installs an update over an existing app when both are signed with the same key. Without your own key, each build gets a one-off key, and updating means uninstalling first (sync brings your data back). Setting one up takes about five minutes and is done once.

**1. Make a keystore.** This needs `keytool`, which comes with Java. If `keytool -help` doesn't work, install a JDK such as [Eclipse Temurin](https://adoptium.net) (on Windows: `winget install EclipseAdoptium.Temurin.21.JDK`, then open a new terminal). Then run this, using a password you'll remember:

```
keytool -genkeypair -keystore identity.jks -alias identity -keyalg RSA -keysize 2048 -validity 10000 -storepass YOUR_PASSWORD -keypass YOUR_PASSWORD -dname "CN=Identity"
```

The alias must be `identity`, and both passwords must be the same, because the build uses one password for both. Stick to letters and numbers in the password. In PowerShell, `$` starts a variable, so a password like `Pa$$word` silently becomes something else, and the secret you type into GitHub won't match.

To check a keystore and password before uploading, run `keytool -list -keystore identity.jks -alias identity` and type the password when asked. If it prints an entry for `identity`, they match.

**2. Turn it into text.** GitHub secrets hold text, so encode the file as base64:

- Windows (PowerShell): `[Convert]::ToBase64String([IO.File]::ReadAllBytes("identity.jks")) | Set-Clipboard`
- macOS: `base64 -i identity.jks | pbcopy`
- Linux: `base64 -w0 identity.jks`, then copy the output

**3. Add two repository secrets.** On GitHub, open this repository's **Settings → Secrets and variables → Actions** and press **New repository secret** for each:

| Name | Value |
| --- | --- |
| `ANDROID_KEYSTORE` | the base64 text from step 2 |
| `ANDROID_KEYSTORE_PASSWORD` | the password from step 1 |

**4. Build and reinstall once.** Re-run the latest **Build Android app** workflow (open it under **Actions**, then **Re-run all jobs**), or push any change. If the "No ANDROID_KEYSTORE secret" warning is gone from the run, signing worked. The app on your phone still has the old one-off key, so uninstall it once and install the new APK. From then on, every new APK installs straight over the last one.

If the build fails at **Set up signing**, its error says which part doesn't match: the password, the alias, or the key password. Fix the secret or make a new keystore, then re-run the workflow.

**Keep `identity.jks` and its password somewhere safe**, such as a password manager, and never commit it: this repository is public. If you lose it, you can make a new one, but the next update will need one more uninstall.

## Goals

Open **Goals** and add an area of your life, such as Health, Career or Money. Each area has six buckets of goals: 1 day, 1 week, 1 month, 1 year, 5 years and 10 years. A goal can be a step toward a longer goal in the same area (a 1 month "Run 10k" toward a 1 year "Run a half marathon"), and any task can count toward a goal through its **Goal** field.

A goal's subgoals and linked tasks are its steps. Each card shows how many steps are done, such as 2/4, and the percentage, which counts a half-done subgoal as half a step. A goal with steps completes itself when they are all done; one without steps you tick off yourself. Goals sync between devices like everything else.

## Android widgets

Long-press your home screen, choose **Widgets**, find **Identity**, and drag out either widget:

- **Identity: Today** shows today's habits and the tasks due today or overdue. Tap a tick box to mark a yes/no habit or a task done (or undo it). Habits you log as an amount or a rating, and the title, open the app on Today.
- **Identity: Goals** shows each area's goals with their steps done and a progress bar. Tap a goal to open Goals in the app.

Both resize. They read the app's database on the phone, so ticks show in the app straight away and go to your other devices on the app's next sync. They refresh when you leave the app, after each tick, and every 30 minutes.

## Tasks

Open **Tasks**, or type into "Add a task" on Today. A task can have a due date and time, tags, notes and a reminder (at the due time, 15 minutes, an hour or a day before, or any time you pick). Tasks with a date show on that day in Today and on the calendar, and overdue ones stay on Today until done.

## Notifications

Habits and tasks can both remind you:

- **Habits:** open a habit on the Habits screen and add one or more times under **Reminders**. You get a notification at each time on days the habit is due, unless you've already logged it that day. A "times per week" habit stops reminding you for the rest of the week once you've reached its count.
- **Tasks:** pick a reminder in the task editor. **Data → Notifications → Reminder for new tasks** sets the one new tasks start with, so every dated task can get one without picking it each time.

Data → Notifications also turns notifications on or off for that device and sends a test one.

On Android, reminders are scheduled with the system, so they arrive even when the app is closed (allow notifications when asked). Habit reminders are planned a week ahead and topped up whenever you open the app, so open it at least once a week. Ticking a habit on the home-screen widget cancels the rest of that day's reminders for it. On Windows, the app shows reminders while it's running, including when it's minimized.

## Google Calendar

The Windows app connects to Google Calendar (Data → Google Calendar). Tasks with a date are copied to a calendar called "Identity" in your Google account (all-day, or 30 minutes at the due time) and kept up to date as you edit, finish (shown with ✓) or delete them. Events from your other Google calendars, from 30 days back to 120 days ahead, show read-only under Schedule on Today and on the calendar, each in its Google colour. The Calendar screen has a **Calendars** row listing the same calendars as Google Calendar's sidebar. They start ticked or unticked as they are in Google, and you can switch each on or off there; that choice is kept on each device. The phone gets those events through sync; Google sign-in only runs on the desktop. Edits made to the "Identity" events in Google are overwritten by the app.

### Setting up your Google sign-in key

Google only lets an app read and write your calendar once it has its own sign-in key (an OAuth client). This app doesn't ship one, because the repository is public and a key in it could be misused. You make your own once in about ten minutes, and it is free. Do this on the Windows PC.

**1. Create a Google Cloud project**

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and sign in with the Google account whose calendar you want to use.
2. If asked, accept the terms of service. No billing account or payment details are needed.
3. Click the project picker at the top left (next to the Google Cloud logo), then **New project**.
4. Name it `Identity` (any name works), leave Location as is, and press **Create**.
5. When it finishes, make sure the project picker shows `Identity` before you continue.

**2. Turn on the Google Calendar API**

1. Open the menu (☰), then **APIs & Services → Library**. You can also search for "Calendar API" in the top search bar.
2. Click **Google Calendar API**, then **Enable**.

**3. Set up the consent screen**

This is the page Google shows when you connect.

1. Open the menu, then **Google Auth Platform**. In older consoles it is **APIs & Services → OAuth consent screen**.
2. Press **Get started**, then fill in:
   - **App name**: `Identity`
   - **User support email**: your email
   - **Audience**: **External**. (Internal only exists for Google Workspace organisations.)
   - **Contact information**: your email
3. Agree to the user data policy and press **Create**.

**4. Publish the app**

If you skip this, Google treats the app as "testing", and your sign-in stops working after 7 days.

1. In Google Auth Platform, open **Audience**.
2. Under **Publishing status**, press **Publish app**, then **Confirm**.
3. Google will say the app needs verification. You don't need it: verification is for apps used by the public, and an unverified app works fine for you. You'll just see a warning when you connect.

You don't need to add scopes under **Data access**. The app asks for exactly three when you connect: "See, create, change, and delete secondary calendars it creates", "See the list of Google calendars you're subscribed to", and "View events on all your calendars".

**5. Create the Desktop client**

1. In Google Auth Platform, open **Clients**, then **Create client**. In older consoles it is **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Set **Application type** to **Desktop app**. Other types such as "Web application" won't work.
3. Name it `Identity desktop` and press **Create**.
4. A dialog shows the **Client ID** (ending in `.apps.googleusercontent.com`) and the **Client secret** (starting with `GOCSPX-`). Keep it open, or download the JSON. You can always come back to **Clients** and open the client to see them again.

**6. Connect the app**

1. In Identity, open **Data → Google Calendar**.
2. Paste the client ID and client secret into their fields.
3. Press **Connect**. Your browser opens a Google sign-in page.
4. Choose your account. When Google says **"Google hasn't verified this app"**, click **Advanced**, then **Go to Identity (unsafe)**. It is "unsafe" only because Google hasn't reviewed it; it is your own key.
5. Tick all three permissions and press **Continue**. The browser says you can close the tab, and the app shows "Connected".

The first sync creates a calendar called **Identity** in your Google account, copies your dated tasks into it, and loads your events. After that it syncs every 10 minutes, a few seconds after you change a task, and whenever you press **Sync now**.

The client ID, secret and sign-in tokens are stored only in the app's local database (`identity.db`), never in this repository or the Syncthing sync files. Phones get the events through sync and don't need their own key.

**If something goes wrong**

- **"Access blocked: … has not completed the Google verification process"** (error 403 `access_denied`): the app is still in testing mode. Go back to step 4 and press **Publish app**. Or, under **Audience → Test users**, add your own email.
- **"redirect_uri_mismatch"** or "invalid request": the client isn't a **Desktop app**. Create a new client of that type (step 5).
- **"invalid_client"**: the ID or secret was pasted wrong, often with a missing character or an extra space. Copy both again from **Clients**.
- **"Google Calendar API has not been used in project … or it is disabled"**: do step 2, wait a minute, then press **Sync now**.
- **It worked, but a week later sync shows "Google sign-in failed: … expired or revoked"**: the app was still in testing mode when you connected. Publish it (step 4), then **Disconnect** and **Connect** again.
- **The Calendar screen says "Showing your primary calendar only"**: you connected before the app could read your calendar list, or you left that permission unticked. Press **Disconnect**, then **Connect**, and tick all three.
- **"Google didn't grant offline access"**: remove Identity at [myaccount.google.com/connections](https://myaccount.google.com/connections), then press **Connect** again.
- **The browser didn't open, or you closed it**: press **Connect** again. The app waits up to 5 minutes for the sign-in to finish.
- **To stop syncing**: press **Disconnect** in the app. To revoke access completely, also remove "Identity" at [myaccount.google.com/connections](https://myaccount.google.com/connections). The **Identity** calendar stays in Google until you delete it there.

## Backups and export

Open **Data**. A backup of everything is written once a day while the app is open (`backups/` next to `identity.db`), and the last 30 are kept. **Restore** next to a backup, or **Import JSON**, merges that file in: anything missing comes back, and records changed more recently than the file are kept. **Export CSV** writes two spreadsheets, your habit log and your journal. On Android, exports go to the Download folder, and imports are picked from there.

## Sync

1. In Syncthing, share one folder between your PC and phone (for example `Identity`).
2. In the app on each device, open **Data**, choose that folder and press **Save**. On Android, type the folder path shown in Syncthing (such as `/storage/emulated/0/Syncthing/Identity`) and allow **All files access** when asked.

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
