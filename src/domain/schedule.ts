import { parseKey, WEEKDAYS } from "./dates";
import type { Schedule } from "./model";

/** Whether a habit is due on a date. Per-week habits can be done any day, so they show daily. */
export function isDue(schedule: Schedule, date: string): boolean {
  if (schedule.kind === "weekdays") return schedule.days.includes(parseKey(date).getDay());
  return true;
}

export function describeSchedule(schedule: Schedule): string {
  switch (schedule.kind) {
    case "daily":
      return "Every day";
    case "perWeek":
      return `${schedule.n}× per week`;
    case "weekdays": {
      const days = [...schedule.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
      if (days.length === 7) return "Every day";
      if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return "Weekdays";
      return days.map((d) => WEEKDAYS[d]).join(" · ");
    }
  }
}

/** Normalizes a schedule so an empty "specific days" choice never hides a habit forever. */
export function normalizeSchedule(schedule: Schedule): Schedule {
  if (schedule.kind === "weekdays" && schedule.days.length === 0) return { kind: "daily" };
  if (schedule.kind === "perWeek") return { kind: "perWeek", n: Math.min(7, Math.max(1, Math.round(schedule.n))) };
  return schedule;
}
