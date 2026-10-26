import { isAndroid } from "../sync/io";

/** Where Android exports go and imports are looked for. */
export const ANDROID_DOWNLOADS = "/storage/emulated/0/Download";

async function invoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

export const BACKUPS_KEPT = 30;

export const writeBackup = (name: string, contents: string) =>
  invoke<string>("backup_write", { name, contents, keep: BACKUPS_KEPT });
export const listBackups = () => invoke<[string, string[]]>("backup_list", {});
export const readBackup = (name: string) => invoke<string>("backup_read", { name });
export const writeExport = (folder: string, name: string, contents: string) =>
  invoke<string>("export_write", { folder, name, contents });
export const readImport = (path: string) => invoke<string>("import_read", { path });
export const importCandidates = (folder: string) => invoke<string[]>("import_candidates", { folder });

/** The folder exports go to: picked by the user on desktop, Downloads on Android. Null when cancelled. */
export async function exportFolder(): Promise<string | null> {
  if (isAndroid) return ANDROID_DOWNLOADS;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const picked = await open({ directory: true, multiple: false, title: "Choose where to save the export" });
  return typeof picked === "string" ? picked : null;
}

/** Desktop file picker for a JSON backup or export. Null when cancelled. */
export async function pickImportFile(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const picked = await open({ multiple: false, title: "Choose a backup or export", filters: [{ name: "Identity backup", extensions: ["json"] }] });
  return typeof picked === "string" ? picked : null;
}
