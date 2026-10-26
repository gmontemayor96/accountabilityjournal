import type { Area, Day, Goal, Habit, HabitEntry, Tag, Task } from "../domain/model";
import type { EventCache } from "../google/events";

/** A record plus the time it last changed on whichever device changed it. */
export interface Stamped<T> {
  data: T;
  updatedAt: string; // ISO timestamp
}

export type TombstoneKind = "tag" | "entry" | "task" | "area" | "goal";

/** Left behind when a tag or an entry is deleted, so other devices delete it too. */
export interface Tombstone {
  kind: TombstoneKind;
  key: string; // tag, task, area or goal id, or `${habitId}|${date}` for an entry
  deletedAt: string;
}

/** Everything one device knows, as written to its sync file. */
export interface SyncData {
  habits: Stamped<Habit>[];
  tags: Stamped<Tag>[];
  days: Stamped<Day>[];
  entries: Stamped<HabitEntry>[];
  /** Missing in files from versions before tasks. */
  tasks?: Stamped<Task>[];
  /** Missing in files from versions before goals. */
  areas?: Stamped<Area>[];
  goals?: Stamped<Goal>[];
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
  /** Google Calendar events fetched by the desktop app, passed on so the phone can show them. */
  googleEvents?: EventCache;
}

export const entryKey = (e: { habitId: string; date: string }) => `${e.habitId}|${e.date}`;

export function emptySyncData(): SyncData {
  return { habits: [], tags: [], days: [], entries: [], tasks: [], areas: [], goals: [], tombstones: [] };
}
