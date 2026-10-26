import { getHabitType } from "../habitTypes/registry";
import { addDays, parseKey, toKey } from "./dates";
import type { Habit, HabitEntry } from "./model";
import { isDue } from "./schedule";

export interface DayStats {
  due: Habit[];
  done: Habit[];
  /** Share of due habits done, 0 to 1. */
  pct: number;
}

/** Due and done habits for one date. `entries` maps habit id to that date's entry. */
export function dayStats(habits: Habit[], date: string, entries: Record<string, HabitEntry | undefined>, tagFilter?: string | null): DayStats {
  const due = habits.filter((h) => !h.archivedAt && isDue(h.schedule, date) && (!tagFilter || h.tags.includes(tagFilter)));
  const done = due.filter((h) => getHabitType(h.type).isDone(h, entries[h.id]));
  return { due, done, pct: due.length ? done.length / due.length : 0 };
}

/** Indexes entries by date, then habit id. */
export function entriesByDate(entries: HabitEntry[]): Record<string, Record<string, HabitEntry>> {
  const out: Record<string, Record<string, HabitEntry>> = {};
  for (const e of entries) (out[e.date] ??= {})[e.habitId] = e;
  return out;
}

/** Date keys for a month grid: whole weeks, Monday first, padded with the neighbouring months' days. */
export function monthGrid(year: number, month: number): string[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((lead + daysInMonth) / 7);
  const start = toKey(new Date(year, month, 1 - lead));
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
}

export function inMonth(key: string, year: number, month: number): boolean {
  const d = parseKey(key);
  return d.getFullYear() === year && d.getMonth() === month;
}
