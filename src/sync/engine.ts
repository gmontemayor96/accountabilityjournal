import type { Repo } from "../data/repo";
import { changeCount, isEmpty, planMerge } from "./merge";
import type { SyncFile } from "./types";

/** File access for the sync folder. The desktop and Android apps implement it in Rust. */
export interface SyncIO {
  readPeers(folder: string, ownFile: string): Promise<string[]>;
  writeOwn(folder: string, ownFile: string, contents: string): Promise<void>;
}

export const SETTING = {
  folder: "sync.folder",
  deviceId: "sync.deviceId",
  deviceName: "sync.deviceName",
  lastAt: "sync.lastAt",
  lastHash: "sync.lastHash",
} as const;

export type SyncResult =
  | { status: "off" }
  | { status: "ok"; at: string; devices: string[]; applied: number }
  | { status: "error"; at: string; message: string };

export async function deviceId(repo: Repo): Promise<string> {
  let id = await repo.getSetting(SETTING.deviceId);
  if (!id) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, "0")).join("");
    await repo.setSetting(SETTING.deviceId, id);
  }
  return id;
}

export const ownFileName = (id: string) => `identity-sync-${id}.json`;

function parse(text: string): SyncFile | null {
  try {
    const f = JSON.parse(text) as SyncFile;
    return f?.format === "identity-sync" && f.version === 1 && f.data ? f : null;
  } catch {
    return null; // a file Syncthing is still writing, or something else entirely
  }
}


// FNV-1a, enough to tell whether our data changed since the last write.
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16);
}

/**
 * One sync round: merge every other device's file into the local database, then write this
 * device's file. The file is only rewritten when the data changed, so Syncthing stays quiet.
 */
export async function syncOnce(repo: Repo, io: SyncIO, fallbackName: string): Promise<SyncResult> {
  const folder = (await repo.getSetting(SETTING.folder))?.trim();
  if (!folder) return { status: "off" };
  const at = new Date().toISOString();
  try {
    const id = await deviceId(repo);
    const file = ownFileName(id);
    const peers = (await io.readPeers(folder, file)).map(parse).filter((f): f is SyncFile => !!f && f.deviceId !== id);
    const changes = planMerge(await repo.snapshot(), peers.map((p) => p.data));
    if (!isEmpty(changes)) await repo.applyChanges(changes);

    const data = await repo.snapshot();
    const body = JSON.stringify(data);
    const h = hash(body);
    if (h !== (await repo.getSetting(SETTING.lastHash))) {
      const out: SyncFile = {
        format: "identity-sync", version: 1, deviceId: id,
        deviceName: (await repo.getSetting(SETTING.deviceName)) || fallbackName, writtenAt: at, data,
      };
      await io.writeOwn(folder, file, JSON.stringify(out));
      await repo.setSetting(SETTING.lastHash, h);
    }
    await repo.setSetting(SETTING.lastAt, at);
    return { status: "ok", at, devices: [...new Set(peers.map((p) => p.deviceName))], applied: changeCount(changes) };
  } catch (e) {
    return { status: "error", at, message: e instanceof Error ? e.message : String(e) };
  }
}
