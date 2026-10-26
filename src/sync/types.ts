import type { Day, Habit, HabitEntry, Tag } from "../domain/model";

/** A record plus the time it last changed on whichever device changed it. */
export interface Stamped<T> {
  data: T;
  updatedAt: string; // ISO timestamp
}

export type TombstoneKind = "tag" | "entry";

/** Left behind when a tag or an entry is deleted, so other devices delete it too. */
export interface Tombstone {
  kind: TombstoneKind;
  key: string; // tag id, or `${habitId}|${date}` for an entry
  deletedAt: string;
}

/** Everything one device knows, as written to its sync file. */
export interface SyncData {
  habits: Stamped<Habit>[];
  tags: Stamped<Tag>[];
  days: Stamped<Day>[];
  entries: Stamped<HabitEntry>[];
  tombstones: Tombstone[];
}

/** What a merge asks the local database to do. Timestamps are kept as they came. */
export type SyncChanges = SyncData;

export interface SyncFile {
  format: "identity-sync";
  version: 1;
  deviceId: string;
  deviceName: string;
  writtenAt: string;
  data: SyncData;
}

export const entryKey = (e: { habitId: string; date: string }) => `${e.habitId}|${e.date}`;

export function emptySyncData(): SyncData {
  return { habits: [], tags: [], days: [], entries: [], tombstones: [] };
}
