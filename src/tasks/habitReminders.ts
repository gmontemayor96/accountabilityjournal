import { addDays, parseKey, toKey } from "../domain/dates";
import type { Habit, HabitEntry } from "../domain/model";
import { isDue } from "../domain/schedule";
import { getHabitType } from "../habitTypes";
import { localStamp, notificationId } from "./reminders";

/** How far ahead Android is given habit reminders. Opening the app tops the window up again. */
export const HABIT_REMINDER_DAYS = 7;

export interface HabitReminder {
  habit: Habit;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  /** Local YYYY-MM-DDTHH:MM. */
  at: string;
}

/** Keeps "HH:MM" times only, sorted and without repeats. */
export function cleanTimes(times: string[] | undefined): string[] {
  return [...new Set((times ?? []).filter((t) => /^\d{2}:\d{2}$/.test(t)))].sort();
}

/** Monday of the week a date is in, matching the calendar's weeks. */
const weekStart = (date: string) => addDays(date, -((parseKey(date).getDay() + 6) % 7));

/** The first date habit reminders need entries from: the start of this week. */
export const entriesFrom = (now: Date) => weekStart(toKey(now));

/**
 * Whether a habit still wants a nudge on a date: it's active and due, it isn't done that day,
 * and for "times per week" habits, the week's count isn't reached yet.
 */
export function wantsReminder(habit: Habit, date: string, entries: HabitEntry[]): boolean {
  if (habit.archivedAt || !isDue(habit.schedule, date)) return false;
  const type = getHabitType(habit.type);
  const own = entries.filter((e) => e.habitId === habit.id);
  if (type.isDone(habit, own.find((e) => e.date === date))) return false;
  if (habit.schedule.kind === "perWeek") {
    const from = weekStart(date);
    const to = addDays(from, 6);
    const done = own.filter((e) => e.date >= from && e.date <= to && type.isDone(habit, e)).length;
    if (done >= habit.schedule.n) return false;
  }
  return true;
}

function remindersOn(habits: Habit[], date: string, entries: HabitEntry[]): HabitReminder[] {
  const out: HabitReminder[] = [];
  for (const habit of habits) {
    const times = cleanTimes(habit.reminders);
    if (!times.length || !wantsReminder(habit, date, entries)) continue;
    for (const time of times) out.push({ habit, date, time, at: `${date}T${time}` });
  }
  return out;
}

/** Reminders still to come over the next few days, soonest first. For Android to schedule. */
export function upcomingHabitReminders(habits: Habit[], entries: HabitEntry[], now: Date, days = HABIT_REMINDER_DAYS): HabitReminder[] {
  const nowStamp = localStamp(now);
  const today = toKey(now);
  const out: HabitReminder[] = [];
  for (let i = 0; i < days; i++) out.push(...remindersOn(habits, addDays(today, i), entries));
  return out.filter((r) => r.at > nowStamp).sort((a, b) => a.at.localeCompare(b.at));
}

/** Today's reminders whose time has come and that this device hasn't shown. For the desktop app. */
export function dueHabitReminders(habits: Habit[], entries: HabitEntry[], now: Date, sent: Set<string>): HabitReminder[] {
  const nowStamp = localStamp(now);
  return remindersOn(habits, toKey(now), entries).filter((r) => r.at <= nowStamp && !sent.has(habitSentKey(r)));
}

export const habitSentKey = (r: HabitReminder) => `${r.habit.id}@${r.at}`;

/** Stable per habit, day and time, so the widget can cancel today's reminder when a habit is ticked there. */
export const habitNotificationId = (r: Pick<HabitReminder, "habit" | "at">) => notificationId(`${r.habit.id}@${r.at}`);

export const habitBody = (r: HabitReminder) => r.habit.identity || "Not logged yet today";
