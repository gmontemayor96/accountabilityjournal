import { getHabitType } from "../habitTypes/registry";
import { MOODS } from "../domain/model";
import type { SyncData } from "../sync/types";

/** A full copy of the data, used by backups and Export JSON. Import accepts these and sync files. */
export interface BackupFile {
  format: "identity-backup";
  version: 1;
  writtenAt: string;
  data: SyncData;
}

export function toBackup(data: SyncData, writtenAt = new Date().toISOString()): BackupFile {
  return { format: "identity-backup", version: 1, writtenAt, data };
}

/** Reads a backup, an export, or a sync file. Returns null for anything else. */
export function parseBackup(text: string): SyncData | null {
  try {
    const f = JSON.parse(text) as { format?: string; version?: number; data?: SyncData };
    if ((f.format !== "identity-backup" && f.format !== "identity-sync") || f.version !== 1 || !f.data) return null;
    const d = f.data;
    return Array.isArray(d.habits) && Array.isArray(d.tags) && Array.isArray(d.days) && Array.isArray(d.entries) && Array.isArray(d.tombstones)
      ? d : null;
  } catch {
    return null;
  }
}

function cell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const row = (cells: (string | number | null | undefined)[]) => cells.map(cell).join(",");

/** One row per logged habit per day, for spreadsheets. */
export function entriesCsv(d: SyncData): string {
  const habits = new Map(d.habits.map((h) => [h.data.id, h.data]));
  const lines = [row(["date", "habit", "value", "unit", "done", "note", "details"])];
  const entries = d.entries.map((e) => e.data).sort((a, b) => a.date.localeCompare(b.date) || a.habitId.localeCompare(b.habitId));
  for (const e of entries) {
    const h = habits.get(e.habitId);
    if (!h) continue;
    const labels = new Map(h.fields.map((f) => [f.id, f.label]));
    const details = Object.entries(e.fields).filter(([, v]) => v).map(([k, v]) => `${labels.get(k) ?? k}: ${v}`).join("; ");
    lines.push(row([e.date, h.name, e.value, h.unit, getHabitType(h.type).isDone(h, e) ? "yes" : "no", e.note, details]));
  }
  return lines.join("\r\n") + "\r\n";
}

/** One row per day with a journal entry, mood or tags. */
export function journalCsv(d: SyncData): string {
  const tags = new Map(d.tags.map((t) => [t.data.id, t.data.name]));
  const lines = [row(["date", "mood", "tags", "journal"])];
  for (const { data: day } of [...d.days].sort((a, b) => a.data.date.localeCompare(b.data.date))) {
    if (!day.journal && day.mood == null && !day.tags.length) continue;
    lines.push(row([day.date, day.mood == null ? "" : MOODS[day.mood], day.tags.map((t) => tags.get(t) ?? t).join("; "), day.journal]));
  }
  return lines.join("\r\n") + "\r\n";
}
