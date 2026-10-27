import { addDays, toKey } from "../domain/dates";
import type { Task } from "../domain/model";
import { isAndroid } from "../sync/io";
import { habitBody, habitNotificationId, type HabitReminder } from "./habitReminders";

const pad = (n: number) => String(n).padStart(2, "0");

/** Local "YYYY-MM-DDTHH:MM", the format reminders are stored in. */
export const localStamp = (d: Date) => `${toKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const parseStamp = (s: string) => {
  const [date, time] = s.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
};

/** Reminder choices in the task editor, as a stamp derived from the due date and time. */
export const REMIND_OPTIONS = [
  { key: "", label: "No reminder" },
  { key: "at", label: "At due time" },
  { key: "15m", label: "15 minutes before" },
  { key: "1h", label: "1 hour before" },
  { key: "1d", label: "1 day before" },
  { key: "custom", label: "Custom…" },
] as const;
export type RemindKey = (typeof REMIND_OPTIONS)[number]["key"];

/** Due time used for reminders when a task has a date but no time. */
export const DEFAULT_TIME = "09:00";

export function reminderFor(key: RemindKey, dueDate: string | null, dueTime: string | null): string | null {
  if (!key || key === "custom" || !dueDate) return null;
  const due = parseStamp(`${dueDate}T${dueTime ?? DEFAULT_TIME}`);
  const minutes = { at: 0, "15m": 15, "1h": 60, "1d": 1440 }[key];
  return localStamp(new Date(due.getTime() - minutes * 60_000));
}

/** Which preset a stored reminder matches, so the editor can show it. */
export function reminderKey(task: Pick<Task, "remindAt" | "dueDate" | "dueTime">): RemindKey {
  if (!task.remindAt) return "";
  for (const o of REMIND_OPTIONS) {
    if (o.key && o.key !== "custom" && reminderFor(o.key, task.dueDate, task.dueTime) === task.remindAt) return o.key;
  }
  return "custom";
}

/** Reminders whose time has come and that this device hasn't shown yet, skipping ones over a day old. */
export function dueReminders(tasks: Task[], now: Date, sent: Set<string>): Task[] {
  const nowStamp = localStamp(now);
  const oldest = `${addDays(toKey(now), -1)}T${nowStamp.slice(11)}`;
  return tasks.filter((t) => !t.doneAt && t.remindAt && t.remindAt <= nowStamp && t.remindAt > oldest && !sent.has(sentKey(t)));
}
export const sentKey = (t: Task) => `${t.id}@${t.remindAt}`;

/**
 * Android notification ids are 32-bit ints; derive a stable, positive one from a string.
 * Same as Java's String.hashCode() with the sign bit cleared, so the widget can work it out too.
 */
export function notificationId(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  return h & 0x7fffffff || 1;
}

const body = (t: Task) => (t.dueDate ? `Due ${t.dueDate}${t.dueTime ? ` at ${t.dueTime}` : ""}` : "Task reminder");

export async function ensurePermission(): Promise<boolean> {
  const n = await import("@tauri-apps/plugin-notification");
  if (await n.isPermissionGranted()) return true;
  return (await n.requestPermission()) === "granted";
}

/** Android keeps at most 500 alarms per app; stay well under it, keeping the soonest. */
const MAX_SCHEDULED = 300;

/**
 * Keeps reminders in step with tasks and habits. Android schedules them with the system, so they fire
 * with the app closed. The desktop app shows them itself while it is running (checked every 30 s).
 */
export async function scheduleAndroid(tasks: Task[], habits: HabitReminder[]): Promise<void> {
  const n = await import("@tauri-apps/plugin-notification");
  if (!(await n.isPermissionGranted())) return;
  await n.cancelAll();
  const now = localStamp(new Date());
  const all = [
    ...tasks
      .filter((t) => !t.doneAt && t.remindAt && t.remindAt > now)
      .map((t) => ({ at: t.remindAt!, id: notificationId(t.id), title: t.title, body: body(t) })),
    ...habits.map((r) => ({ at: r.at, id: habitNotificationId(r), title: r.habit.name, body: habitBody(r) })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  for (const r of all.slice(0, MAX_SCHEDULED)) {
    n.sendNotification({ id: r.id, title: r.title, body: r.body, schedule: n.Schedule.at(parseStamp(r.at), false, true) });
  }
}

export async function show(title: string, text: string): Promise<void> {
  const n = await import("@tauri-apps/plugin-notification");
  if (!(await n.isPermissionGranted())) return;
  n.sendNotification({ title, body: text });
}

export const showNow = (t: Task) => show(t.title, body(t));
export const showHabitNow = (r: HabitReminder) => show(r.habit.name, habitBody(r));

export const remindersScheduledBySystem = isAndroid;
