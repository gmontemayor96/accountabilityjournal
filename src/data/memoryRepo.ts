import { emptyDay, type Day, type Habit, type HabitEntry, type Tag } from "../domain/model";
import type { Repo } from "./repo";

interface Snapshot {
  habits: Habit[];
  tags: Tag[];
  days: Record<string, Day>;
  entries: Record<string, HabitEntry>; // key: `${habitId}|${date}`
}

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
    this.persist();
  }
  async setHabitArchived(id: string, archivedAt: string | null) {
    const h = this.s.habits.find((x) => x.id === id);
    if (h) h.archivedAt = archivedAt;
    this.persist();
  }
  async loadTags() {
    return structuredClone(this.s.tags).sort((a, b) => a.name.localeCompare(b.name));
  }
  async saveTag(t: Tag) {
    const i = this.s.tags.findIndex((x) => x.id === t.id);
    if (i >= 0) this.s.tags[i] = { ...t };
    else this.s.tags.push({ ...t });
    this.persist();
  }
  async deleteTag(id: string) {
    this.s.tags = this.s.tags.filter((t) => t.id !== id);
    for (const h of this.s.habits) h.tags = h.tags.filter((t) => t !== id);
    for (const d of Object.values(this.s.days)) d.tags = d.tags.filter((t) => t !== id);
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
    this.persist();
  }
  async saveEntry(e: HabitEntry) {
    this.s.entries[`${e.habitId}|${e.date}`] = structuredClone(e);
    this.persist();
  }
  async deleteEntry(habitId: string, date: string) {
    delete this.s.entries[`${habitId}|${date}`];
    this.persist();
  }
}
