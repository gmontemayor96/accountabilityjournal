import type { SyncIO } from "./engine";

export const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
export const defaultDeviceName = isAndroid ? "Android phone" : "Windows PC";

/** Added to the Android web view by MainActivity.kt. */
interface AndroidBridge {
  hasAllFilesAccess(): boolean;
  openAllFilesSettings(): void;
}
export const androidBridge = (): AndroidBridge | undefined =>
  (window as unknown as { IdentityAndroid?: AndroidBridge }).IdentityAndroid;

export const tauriSyncIO: SyncIO = {
  async readPeers(folder, ownFile) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<string[]>("sync_read_peers", { folder, ownFile });
  },
  async writeOwn(folder, ownFile, contents) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("sync_write_own", { folder, ownFile, contents });
  },
};

/** Desktop folder picker. Returns null when cancelled. */
export async function pickFolder(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const picked = await open({ directory: true, multiple: false, title: "Choose your Syncthing folder" });
  return typeof picked === "string" ? picked : null;
}
