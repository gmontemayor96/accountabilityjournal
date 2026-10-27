import { describe, expect, it } from "vitest";
import type { Habit, HabitEntry } from "../domain/model";
import { cleanTimes, dueHabitReminders, habitNotificationId, habitSentKey, upcomingHabitReminders, wantsReminder } from "./habitReminders";

const habit = (over: Partial<Habit>): Habit => ({
  id: "h", name: "Read", identity: "", color: "#000", type: "check", target: null, unit: "", schedule: { kind: "daily" },
  sortOrder: 0, createdAt: "", archivedAt: null, tags: [], fields: [], reminders: ["09:00"], ...over,
});
const entry = (habitId: string, date: string, value: number | null = 1): HabitEntry => ({ habitId, date, value, note: "", fields: {}, loggedAt: "" });

// Tuesday 27 October 2026, 10:00.
const now = new Date(2026, 9, 27, 10, 0);

describe("habit reminders", () => {
  it("keeps valid times only, sorted and once each", () => {
    expect(cleanTimes(["18:00", "", "07:30", "18:00", "7:5"])).toEqual(["07:30", "18:00"]);
    expect(cleanTimes(undefined)).toEqual([]);
  });

  it("skips days a habit isn't due, is done, or is archived", () => {
    const weekdays = habit({ schedule: { kind: "weekdays", days: [1, 3] } });
    expect(wantsReminder(weekdays, "2026-10-27", [])).toBe(false); // Tuesday
    expect(wantsReminder(weekdays, "2026-10-28", [])).toBe(true); // Wednesday
    expect(wantsReminder(habit({}), "2026-10-27", [entry("h", "2026-10-27")])).toBe(false);
    expect(wantsReminder(habit({}), "2026-10-27", [entry("h", "2026-10-27", null)])).toBe(true); // only a note
    expect(wantsReminder(habit({ archivedAt: "x" }), "2026-10-27", [])).toBe(false);
  });

  it("stops a times-per-week habit once the week's count is reached", () => {
    const twice = habit({ schedule: { kind: "perWeek", n: 2 } });
    const entries = [entry("h", "2026-10-26"), entry("h", "2026-10-25")]; // Monday this week, Sunday last week
    expect(wantsReminder(twice, "2026-10-27", entries)).toBe(true);
    entries.push(entry("h", "2026-10-28"));
    expect(wantsReminder(twice, "2026-10-29", entries)).toBe(false);
    expect(wantsReminder(twice, "2026-11-02", entries)).toBe(true); // next Monday, a new week
  });

  it("plans the coming week, soonest first, leaving out times already gone and days already done", () => {
    const h = habit({ reminders: ["09:00", "20:00"] });
    const plan = upcomingHabitReminders([h], [entry("h", "2026-10-28")], now, 3);
    expect(plan.map((r) => r.at)).toEqual(["2026-10-27T20:00", "2026-10-29T09:00", "2026-10-29T20:00"]);
  });

  it("finds today's reminders that are due and not shown yet", () => {
    const h = habit({ reminders: ["08:00", "09:30", "11:00"] });
    const first = dueHabitReminders([h], [], now, new Set());
    expect(first.map((r) => r.time)).toEqual(["08:00", "09:30"]);
    expect(dueHabitReminders([h], [], now, new Set([habitSentKey(first[0])])).map((r) => r.time)).toEqual(["09:30"]);
    expect(dueHabitReminders([h], [entry("h", "2026-10-27")], now, new Set())).toEqual([]);
  });

  it("gives each habit, day and time its own id, matching Java's String.hashCode", () => {
    const a = habitNotificationId({ habit: habit({ id: "h_abc" }), at: "2026-10-27T09:00" });
    expect(a).toBe(habitNotificationId({ habit: habit({ id: "h_abc" }), at: "2026-10-27T09:00" }));
    expect(a).not.toBe(habitNotificationId({ habit: habit({ id: "h_abc" }), at: "2026-10-28T09:00" }));
    // "h_abc@2026-10-27T09:00".hashCode() in Java, with the sign bit cleared.
    expect(a).toBe(javaHash("h_abc@2026-10-27T09:00") & 0x7fffffff);
  });
});

function javaHash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 2 ** 32;
  return h >= 2 ** 31 ? h - 2 ** 32 : h;
}
