import { addDays } from "../domain/dates";
import type { Task } from "../domain/model";

/** A Google Calendar event as the app shows it: read-only, on the days it covers. */
export interface CalEvent {
  id: string;
  title: string;
  startDate: string; // YYYY-MM-DD, local
  startTime: string | null; // HH:MM local, null for all-day
  endDate: string; // last day it covers, inclusive
  endTime: string | null;
}

export interface EventCache {
  fetchedAt: string;
  events: CalEvent[];
}

/** Events on a date, all-day ones first, then by start time. */
export function eventsOn(events: CalEvent[], date: string): CalEvent[] {
  return events
    .filter((e) => e.startDate <= date && date <= e.endDate)
    .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.title.localeCompare(b.title));
}

export function eventTimeLabel(e: CalEvent, date: string): string {
  if (!e.startTime) return "All day";
  if (e.startDate !== date) return e.endDate === date && e.endTime ? `until ${e.endTime}` : "All day";
  return e.endTime && e.endDate === e.startDate ? `${e.startTime}–${e.endTime}` : e.startTime;
}

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

interface GoogleTime { date?: string; dateTime?: string }
export interface GoogleEvent {
  id: string;
  status?: string;
  summary?: string;
  start?: GoogleTime;
  end?: GoogleTime;
}

/** Converts an event from the Calendar API into local dates and times. Cancelled events give null. */
export function fromGoogle(g: GoogleEvent): CalEvent | null {
  if (g.status === "cancelled" || !g.start || !g.end) return null;
  const title = g.summary?.trim() || "(No title)";
  if (g.start.date && g.end.date) {
    // All-day: Google's end date is exclusive.
    return { id: g.id, title, startDate: g.start.date, startTime: null, endDate: addDays(g.end.date, -1), endTime: null };
  }
  if (!g.start.dateTime || !g.end.dateTime) return null;
  const s = new Date(g.start.dateTime), e = new Date(g.end.dateTime);
  // An event ending exactly at midnight belongs to the day before.
  const last = localTime(e) === "00:00" && e > s ? new Date(e.getTime() - 60_000) : e;
  return { id: g.id, title, startDate: localDate(s), startTime: localTime(s), endDate: localDate(last), endTime: localTime(e) };
}

/** Google event ids allow a-v and 0-9; hex fits, so each task gets a stable event id. */
export function eventIdFor(taskId: string): string {
  return "idt" + Array.from(new TextEncoder().encode(taskId), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The event body for a dated task: all-day without a time, 30 minutes with one. */
export function taskToEvent(t: Task, timeZone: string): Record<string, unknown> | null {
  if (!t.dueDate) return null;
  const summary = t.doneAt ? `✓ ${t.title}` : t.title;
  const base = {
    summary,
    status: "confirmed", // brings back an event that was deleted earlier
    description: [t.notes, "Added by Identity. Edit this task in the app; changes here are overwritten."].filter(Boolean).join("\n\n"),
    transparency: "transparent",
    reminders: { useDefault: false },
    extendedProperties: { private: { identityTask: t.id } },
  };
  if (!t.dueTime) return { ...base, start: { date: t.dueDate }, end: { date: addDays(t.dueDate, 1) } };
  const [h, m] = t.dueTime.split(":").map(Number);
  const end = h * 60 + m + 30;
  const endDate = end >= 1440 ? addDays(t.dueDate, 1) : t.dueDate;
  const endTime = `${pad(Math.floor((end % 1440) / 60))}:${pad(end % 60)}`;
  return {
    ...base,
    start: { dateTime: `${t.dueDate}T${t.dueTime}:00`, timeZone },
    end: { dateTime: `${endDate}T${endTime}:00`, timeZone },
  };
}

/** A fingerprint of everything that ends up in a task's event, to skip unchanged ones. */
export const eventFingerprint = (t: Task) => JSON.stringify([t.title, t.notes, t.dueDate, t.dueTime, !!t.doneAt]);

/**
 * What to send to Google: events to create or update for dated tasks that changed since the last
 * push, and events to delete for tasks that were deleted or lost their date.
 */
export function planPush(tasks: Task[], pushed: Record<string, string>): { upsert: Task[]; remove: string[] } {
  const dated = tasks.filter((t) => t.dueDate);
  const ids = new Set(dated.map((t) => t.id));
  return {
    upsert: dated.filter((t) => pushed[t.id] !== eventFingerprint(t)),
    remove: Object.keys(pushed).filter((id) => !ids.has(id)),
  };
}
