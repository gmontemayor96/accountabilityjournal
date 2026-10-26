import { useEffect, useState } from "react";
import { todayKey } from "../domain/dates";
import { entriesCsv, journalCsv, parseBackup, toBackup } from "../data/exportFormats";
import { ANDROID_DOWNLOADS, BACKUPS_KEPT, exportFolder, importCandidates, listBackups, pickImportFile, readBackup, readImport, writeExport } from "../data/files";
import { isAndroid } from "../sync/io";
import { useStore } from "../store";

const label = (name: string) => name.replace(/^identity-(backup|export)-/, "").replace(/\.json$/, "");

/** Backups, export and import, shown under Sync on the Data screen. */
export function DataSection() {
  const { repo, backupIfDue, importData } = useStore();
  const [backups, setBackups] = useState<{ folder: string; names: string[] }>({ folder: "", names: [] });
  const [androidFiles, setAndroidFiles] = useState<string[]>([]);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const [folder, names] = await listBackups();
    setBackups({ folder, names });
    if (isAndroid) setAndroidFiles(await importCandidates(ANDROID_DOWNLOADS).catch(() => []));
  };
  useEffect(() => { void refresh().catch(() => {}); }, []);

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    try {
      const text = await fn();
      if (text) setMessage({ text });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : String(e), error: true });
    } finally {
      setBusy(false);
      void refresh().catch(() => {});
    }
  };

  const exportJson = () => run(async () => {
    const folder = await exportFolder();
    if (!folder || !repo) return null;
    const path = await writeExport(folder, `identity-export-${todayKey()}.json`, JSON.stringify(toBackup(await repo.snapshot()), null, 1));
    return `Saved ${path}`;
  });
  const exportCsv = () => run(async () => {
    const folder = await exportFolder();
    if (!folder || !repo) return null;
    const data = await repo.snapshot();
    // A byte-order mark so Excel reads accents and emoji as UTF-8.
    const a = await writeExport(folder, `identity-entries-${todayKey()}.csv`, "﻿" + entriesCsv(data));
    const b = await writeExport(folder, `identity-journal-${todayKey()}.csv`, "﻿" + journalCsv(data));
    return `Saved ${a} and ${b}`;
  });
  const importText = async (text: string) => {
    const data = parseBackup(text);
    if (!data) throw new Error("That file isn't an Identity backup or export.");
    const n = await importData(data);
    return n ? `Imported ${n} change${n === 1 ? "" : "s"}.` : "Nothing to import: you already have everything in that file.";
  };
  const importFile = () => run(async () => {
    const path = await pickImportFile();
    return path ? importText(await readImport(path)) : null;
  });

  return (
    <>
      <h2 className="sectionhead">Backups</h2>
      <p className="hint">
        A copy of everything is saved once a day while the app is open, and the last {BACKUPS_KEPT} are kept
        {backups.folder && <> in <code>{backups.folder}</code></>}.
      </p>
      <div className="inline">
        <button className="btn" disabled={busy} onClick={() => run(async () => {
          if (repo) await repo.setSetting("backup.lastDate", "");
          const folder = await backupIfDue();
          return folder ? "Backup saved." : null;
        })}>Back up now</button>
      </div>
      {backups.names.length > 0 && (
        <ul className="filelist">
          {backups.names.slice(0, 7).map((n) => (
            <li key={n}>
              <span>{label(n)}</span>
              <button className="linkbtn" disabled={busy} onClick={() => run(async () => importText(await readBackup(n)))}>Restore</button>
            </li>
          ))}
        </ul>
      )}

      <h2 className="sectionhead">Export and import</h2>
      <p className="hint">
        JSON keeps everything and can be imported again. CSV gives two spreadsheets: your habit log and your journal.
        {isAndroid && " Files are saved to your Download folder."}
      </p>
      <div className="inline">
        <button className="btn" disabled={busy} onClick={exportJson}>Export JSON</button>
        <button className="btn" disabled={busy} onClick={exportCsv}>Export CSV</button>
        {!isAndroid && <button className="btn" disabled={busy} onClick={importFile}>Import JSON…</button>}
      </div>
      {isAndroid && androidFiles.length > 0 && (
        <ul className="filelist">
          {androidFiles.slice(0, 7).map((n) => (
            <li key={n}>
              <span>{n}</span>
              <button className="linkbtn" disabled={busy} onClick={() => run(async () => importText(await readImport(`${ANDROID_DOWNLOADS}/${n}`)))}>Import</button>
            </li>
          ))}
        </ul>
      )}
      <p className="hint">
        Restoring or importing merges: records you changed more recently than the file are kept, and anything missing comes back.
      </p>
      {message && <p className={message.error ? "error" : ""} role="status">{message.text}</p>}
    </>
  );
}
