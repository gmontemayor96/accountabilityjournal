import { emptyDay, type Day, type Habit, type HabitEntry, type Tag, type Task } from "../domain/model";
import { entryKey, type SyncChanges, type SyncData, type Tombstone } from "../sync/types";
import type { Repo } from "./repo";

interface Snapshot {
  habits: Habit[];
  tags: Tag[];
  days: Record<string, Day>;
  entries: Record<string, HabitEntry>; // key: `${habitId}|${date}`
  tasks?: Task[];
  updated?: Record<string, string>; // key: `${kind}:${key}` -> last change
  tombstones?: Tombstone[];
  settings?: Record<string, string>;
}

const EARLY = "2000-01-01T00:00:00.000Z";

/**
 * Keeps data in memory, optionally mirrored to localStorage. Used when the UI runs
 * in a plain browser (`npm run dev`) instead of inside the Windows app, and in tests.
 */
export class MemoryRepo implements Repo {
  private s: Snapshot;

  constructor(initial?: Partial<Snapshot>, private storageKey?: string) {
    let saved: Snapshot | null = null;
    if (storageKey) {
      try {
        const raw = localStorage.getItem(storageKey);
        saved = raw ? (JSON.parse(raw) as Snapshot) : null;
      } catch {
        saved = null;
      }
    }
    this.s = saved ?? { habits: [], tags: [], days: {}, entries: {}, ...initial };
  }

  private stamp(kind: string, key: string, at = new Date().toISOString()) {
    (this.s.updated ??= {})[`${kind}:${key}`] = at;
    this.s.tombstones = (this.s.tombstones ?? []).filter((t) => !(t.kind === kind && t.key === key));
  }
  private bury(t: Tombstone) {
    this.s.tombstones = [...(this.s.tombstones ?? []).filter((x) => !(x.kind === t.kind && x.key === t.key)), t];
  }
  private at(kind: string, key: string) {
    return this.s.updated?.[`${kind}:${key}`] ?? EARLY;
  }

  private persist() {
    if (!this.storageKey) return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.s));
    } catch {
      /* storage unavailable: keep working in memory */
    }
  }

  async loadHabits() {
    return structuredClone(this.s.habits).sort((a, b) => a.sortOrder - b.sortOrder);
  }
  async saveHabit(h: Habit) {
    const i = this.s.habits.findIndex((x) => x.id === h.id);
    if (i >= 0) this.s.habits[i] = structuredClone(h);
    else this.s.habits.push(structuredClone(h));
    this.stamp("habit", h.id);
    this.persist();
  }
  async setHabitArchived(id: string, archivedAt: string | null) {
    const h = this.s.habits.find((x) => x.id === id);
    if (h) h.archivedAt = archivedAt;
    this.stamp("habit", id);
    this.persist();
  }
  async loadTags() {
    return structuredClone(this.s.tags).sort((a, b) => a.name.localeCompare(b.name));
  }
  async saveTag(t: Tag) {
    const i = this.s.tags.findIndex((x) => x.id === t.id);
    if (i >= 0) this.s.tags[i] = { ...t };
    else this.s.tags.push({ ...t });
    this.stamp("tag", t.id);
    this.persist();
  }
  async deleteTag(id: string) {
    this.removeTag({ kind: "tag", key: id, deletedAt: new Date().toISOString() });
    this.persist();
  }
  private removeTag(t: Tombstone) {
    const id = t.key;
    this.bury(t);
    this.s.tags = this.s.tags.filter((t) => t.id !== id);
    for (const h of this.s.habits) h.tags = h.tags.filter((t) => t !== id);
    for (const d of Object.values(this.s.days)) d.tags = d.tags.filter((t) => t !== id);
    for (const t of this.s.tasks ?? []) t.tags = t.tags.filter((x) => x !== id);
  }
  async loadTasks() {
    return structuredClone(this.s.tasks ?? []).sort((a, b) =>
      (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || (a.dueTime ?? "").localeCompare(b.dueTime ?? "") || a.createdAt.localeCompare(b.createdAt));
  }
  async saveTask(t: Task) {
    const list = (this.s.tasks ??= []);
    const i = list.findIndex((x) => x.id === t.id);
    if (i >= 0) list[i] = structuredClone(t);
    else list.push(structuredClone(t));
    this.stamp("task", t.id);
    this.persist();
  }
  async deleteTask(id: string) {
    this.s.tasks = (this.s.tasks ?? []).filter((t) => t.id !== id);
    this.bury({ kind: "task", key: id, deletedAt: new Date().toISOString() });
    this.persist();
  }
  async loadRange(from: string, to: string) {
    const inRange = (d: string) => d >= from && d <= to;
    return {
      days: structuredClone(Object.values(this.s.days).filter((d) => inRange(d.date))).sort((a, b) => a.date.localeCompare(b.date)),
      entries: structuredClone(Object.values(this.s.entries).filter((e) => inRange(e.date))),
    };
  }
  async earliestDate() {
    const dates = [...Object.keys(this.s.days), ...Object.values(this.s.entries).map((e) => e.date)].sort();
    return dates[0] ?? null;
  }
  async loadDay(date: string) {
    const entries = Object.values(this.s.entries).filter((e) => e.date === date);
    return { day: structuredClone(this.s.days[date] ?? emptyDay(date)), entries: structuredClone(entries) };
  }
  async saveDay(day: Day) {
    this.s.days[day.date] = structuredClone(day);
    this.stamp("day", day.date);
    this.persist();
  }
  async saveEntry(e: HabitEntry) {
    this.s.entries[entryKey(e)] = structuredClone(e);
    this.stamp("entry", entryKey(e));
    this.persist();
  }
  async deleteEntry(habitId: string, date: string) {
    const key = entryKey({ habitId, date });
    delete this.s.entries[key];
    this.bury({ kind: "entry", key, deletedAt: new Date().toISOString() });
    this.persist();
  }

  async snapshot(): Promise<SyncData> {
    return structuredClone({
      habits: this.s.habits.map((data) => ({ data, updatedAt: this.at("habit", data.id) })),
      tags: this.s.tags.map((data) => ({ data, updatedAt: this.at("tag", data.id) })),
      days: Object.values(this.s.days).map((data) => ({ data, updatedAt: this.at("day", data.date) })),
      entries: Object.values(this.s.entries).map((data) => ({ data, updatedAt: this.at("entry", entryKey(data)) })),
      tasks: (this.s.tasks ?? []).map((data) => ({ data, updatedAt: this.at("task", data.id) })),
      tombstones: this.s.tombstones ?? [],
    });
  }
  async applyChanges(c: SyncChanges) {
    const put = <T extends { id: string }>(list: T[], item: T) => {
      const i = list.findIndex((x) => x.id === item.id);
      if (i >= 0) list[i] = item;
      else list.push(item);
    };
    for (const r of c.tags) { put(this.s.tags, structuredClone(r.data)); this.stamp("tag", r.data.id, r.updatedAt); }
    const tagIds = new Set(this.s.tags.map((t) => t.id));
    for (const r of c.habits) {
      put(this.s.habits, { ...structuredClone(r.data), tags: r.data.tags.filter((t) => tagIds.has(t)) });
      this.stamp("habit", r.data.id, r.updatedAt);
    }
    for (const r of c.days) {
      this.s.days[r.data.date] = { ...structuredClone(r.data), tags: r.data.tags.filter((t) => tagIds.has(t)) };
      this.stamp("day", r.data.date, r.updatedAt);
    }
    for (const r of c.tasks ?? []) {
      const list = (this.s.tasks ??= []);
      const task = { ...structuredClone(r.data), tags: r.data.tags.filter((t) => tagIds.has(t)) };
      const i = list.findIndex((x) => x.id === task.id);
      if (i >= 0) list[i] = task;
      else list.push(task);
      this.stamp("task", task.id, r.updatedAt);
    }
    const habitIds = new Set(this.s.habits.map((h) => h.id));
    for (const r of c.entries) {
      if (!habitIds.has(r.data.habitId)) continue;
      this.s.entries[entryKey(r.data)] = structuredClone(r.data);
      this.stamp("entry", entryKey(r.data), r.updatedAt);
    }
    for (const t of c.tombstones) {
      if (t.kind === "tag") this.removeTag(t);
      else if (t.kind === "task") { this.s.tasks = (this.s.tasks ?? []).filter((x) => x.id !== t.key); this.bury(t); }
      else { delete this.s.entries[t.key]; this.bury(t); }
    }
    this.persist();
  }
  async getSetting(key: string) {
    return this.s.settings?.[key] ?? null;
  }
  async setSetting(key: string, value: string) {
    (this.s.settings ??= {})[key] = value;
    this.persist();
  }
}
