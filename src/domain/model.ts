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
