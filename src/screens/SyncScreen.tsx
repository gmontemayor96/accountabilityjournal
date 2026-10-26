import { useEffect, useState } from "react";
import { DataSection } from "../components/DataSection";
import { GoogleSection } from "../components/GoogleSection";
import { isDesktopApp } from "../data";
import { SETTING } from "../sync/engine";
import { androidBridge, defaultDeviceName, isAndroid, pickFolder } from "../sync/io";
import { useStore } from "../store";

const time = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function SyncScreen() {
  const { repo, syncing, lastSync, syncNow } = useStore();
  const [folder, setFolder] = useState("");
  const [name, setName] = useState("");
  const [saved, setSaved] = useState({ folder: "", name: "" });
  const [allFiles, setAllFiles] = useState(() => androidBridge()?.hasAllFilesAccess() ?? true);

  useEffect(() => {
    if (!repo) return;
    void Promise.all([repo.getSetting(SETTING.folder), repo.getSetting(SETTING.deviceName)]).then(([f, n]) => {
      setFolder(f ?? "");
      setName(n ?? "");
      setSaved({ folder: f ?? "", name: n ?? "" });
    });
  }, [repo]);

  // Coming back from Android's settings page: check whether access was granted.
  useEffect(() => {
    const check = () => setAllFiles(androidBridge()?.hasAllFilesAccess() ?? true);
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, []);

  const dirty = folder.trim() !== saved.folder || name.trim() !== saved.name;
  const save = async () => {
    if (!repo) return;
    await repo.setSetting(SETTING.folder, folder.trim());
    await repo.setSetting(SETTING.deviceName, name.trim());
    // A new folder or name means our file must be written again.
    await repo.setSetting(SETTING.lastHash, "");
    setSaved({ folder: folder.trim(), name: name.trim() });
    await syncNow();
  };
  const browse = async () => {
    const picked = await pickFolder();
    if (picked) setFolder(picked);
  };

  const denied = lastSync?.status === "error" && /permission denied/i.test(lastSync.message);

  return (
    <>
      <header className="viewhead">
        <div>
          <h1>Data</h1>
          <div className="sub">Sync between your devices, Google Calendar, daily backups, and export to JSON or CSV.</div>
        </div>
      </header>
      <section className="canvas syncpage">
        {!isDesktopApp ? (
          <p className="empty">Sync, backups and export work in the Windows and Android apps. This browser preview keeps its data to itself.</p>
        ) : (
          <>
            <h2 className="sectionhead first">Sync</h2>
            {isAndroid && !allFiles && (
              <div className="notice">
                <p>Identity needs <b>All files access</b> to read and write your Syncthing folder.</p>
                <button className="btn primary" onClick={() => androidBridge()?.openAllFilesSettings()}>Open settings</button>
              </div>
            )}
            <div className="field">
              <label className="label" htmlFor="sync-folder">Sync folder</label>
              <div className="inline">
                <input id="sync-folder" type="text" className="grow" value={folder} onChange={(e) => setFolder(e.target.value)}
                  placeholder={isAndroid ? "/storage/emulated/0/Syncthing/Identity" : "C:\\Users\\you\\Sync\\Identity"} />
                {!isAndroid && <button className="btn" onClick={browse}>Browse…</button>}
              </div>
              <p className="hint">
                Use the same Syncthing folder on every device. Each device keeps one file there and reads the others'.
                {isAndroid && " Copy the folder path from Syncthing's folder settings."}
              </p>
            </div>
            <div className="field">
              <label className="label" htmlFor="sync-name">This device</label>
              <input id="sync-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={defaultDeviceName} />
            </div>
            <div className="inline">
              <button className="btn primary" disabled={!dirty} onClick={save}>Save</button>
              <button className="btn" disabled={!saved.folder || syncing} onClick={() => void syncNow()}>
                {syncing ? "Syncing…" : "Sync now"}
              </button>
            </div>

            <div className="syncstatus" role="status">
              {!saved.folder && <p className="empty">Sync is off. Choose a folder to turn it on.</p>}
              {saved.folder && lastSync?.status === "ok" && (
                <p>
                  Last synced {time(lastSync.at)}.{" "}
                  {lastSync.devices.length
                    ? `Found ${lastSync.devices.join(", ")}.`
                    : "No other device has written to this folder yet."}
                  {lastSync.applied > 0 && ` Brought in ${lastSync.applied} change${lastSync.applied === 1 ? "" : "s"}.`}
                </p>
              )}
              {saved.folder && lastSync?.status === "error" && (
                <p className="error">
                  Couldn't sync: {lastSync.message}
                  {denied && isAndroid && " Allow All files access for Identity, then try again."}
                </p>
              )}
            </div>
            <p className="hint">
              Sync runs when the app opens, when you come back to it, every minute while it is open, and a few seconds after you change
              something. If both devices change the same thing, the later change wins.
            </p>
            <GoogleSection />
            <DataSection />
          </>
        )}
      </section>
    </>
  );
}
