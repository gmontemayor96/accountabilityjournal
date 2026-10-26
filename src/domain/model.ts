export type HabitTypeKey = "check" | "count" | "duration" | "scale";

export type Schedule =
  | { kind: "daily" }
  | { kind: "weekdays"; days: number[] } // 0 = Sunday ... 6 = Saturday
  | { kind: "perWeek"; n: number };

export interface HabitField {
  id: string;
  label: string;
  kind: "text" | "number";
}

export interface Habit {
  id: string;
  name: string;
  identity: string;
  color: string;
  type: HabitTypeKey;
  target: number | null;
  unit: string;
  schedule: Schedule;
  sortOrder: number;
  createdAt: string;
  archivedAt: string | null;
  tags: string[];
  fields: HabitField[];
}

export interface HabitEntry {
  habitId: string;
  date: string; // YYYY-MM-DD
  value: number | null;
  note: string;
  fields: Record<string, string>;
  loggedAt: string; // ISO timestamp
}

export interface Day {
  date: string;
  journal: string;
  mood: number | null; // 0..4
  tags: string[];
}

/** A one-off to-do. Shown on its due date in Today and the calendar. */
export interface Task {
  id: string;
  title: string;
  notes: string;
  dueDate: string | null; // YYYY-MM-DD
  dueTime: string | null; // HH:MM
  remindAt: string | null; // local YYYY-MM-DDTHH:MM
  doneAt: string | null;
  createdAt: string;
  tags: string[];
  /** The goal this task moves forward, if any. Missing on tasks saved before goals. */
  goalId?: string | null;
}

/** A part of life the user cares about, such as Health or Career. Goals live in one. */
export interface Area {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  createdAt: string;
}

/** How far ahead a goal looks. Each area has a bucket of goals for every horizon. */
export type Horizon = "day" | "week" | "month" | "year" | "5y" | "10y";

export interface Goal {
  id: string;
  areaId: string;
  /** A longer-horizon goal in the same area that this one is a step toward. */
  parentId: string | null;
  title: string;
  notes: string;
  horizon: Horizon;
  /** Set when a goal with no subgoals or tasks is ticked off. Goals with them are done when they all are. */
  doneAt: string | null;
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export const PALETTE = ["#E07A5F", "#3D8BD9", "#9B6BD6", "#2FA37A", "#D9A13D", "#D9577F", "#3FA3B5", "#7F9440"];
export const MOODS = ["Rough", "Low", "Okay", "Good", "Great"];

export function newId(prefix: string): string {
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
    : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${rand}`;
}

export function slugTagId(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function emptyDay(date: string): Day {
  return { date, journal: "", mood: null, tags: [] };
}
