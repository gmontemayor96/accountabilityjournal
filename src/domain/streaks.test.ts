import { describe, expect, it } from "vitest";
import "../habitTypes";
import type { Habit, HabitEntry } from "./model";
import { entriesByDate } from "./stats";
import { habitStreak, weekStart } from "./streaks";

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: "h", name: "h", identity: "", color: "#000", type: "check", target: null, unit: "", schedule: { kind: "daily" },
  sortOrder: 0, createdAt: "", archivedAt: null, tags: [], fields: [], ...over,
});
const done = (...dates: string[]) =>
  entriesByDate(dates.map((date): HabitEntry => ({ habitId: "h", date, value: 1, note: "", fields: {}, loggedAt: "" })));

describe("habitStreak", () => {
  it("counts days in a row and keeps the streak while today is still open", () => {
    const byDate = done("2026-10-20", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25");
    expect(habitStreak(habit(), byDate, "2026-10-26")).toEqual({ current: 4, best: 4, unit: "day" });
    expect(habitStreak(habit(), { ...byDate, ...done("2026-10-26") }, "2026-10-26").current).toBe(5);
    expect(habitStreak(habit(), byDate, "2026-10-27")).toEqual({ current: 0, best: 4, unit: "day" });
  });

  it("skips days the habit isn't due", () => {
    const mwf = habit({ schedule: { kind: "weekdays", days: [1, 3, 5] } });
    // Mon 19, Wed 21, Fri 23, Mon 26
    expect(habitStreak(mwf, done("2026-10-19", "2026-10-21", "2026-10-23", "2026-10-26"), "2026-10-27").current).toBe(4);
  });

  it("only counts values that meet the target", () => {
    const read = habit({ type: "count", target: 20 });
    const byDate = entriesByDate([
      { habitId: "h", date: "2026-10-24", value: 25, note: "", fields: {}, loggedAt: "" },
      { habitId: "h", date: "2026-10-25", value: 5, note: "", fields: {}, loggedAt: "" },
    ]);
    expect(habitStreak(read, byDate, "2026-10-26")).toEqual({ current: 0, best: 1, unit: "day" });
  });

  it("counts weeks for per-week habits, with this week left open", () => {
    const thrice = habit({ schedule: { kind: "perWeek", n: 3 } });
    expect(weekStart("2026-10-25")).toBe("2026-10-19");
    // Weeks of Oct 5 (3 days), Oct 12 (3), Oct 19 (2: missed), Oct 26 (1 so far)
    const byDate = done("2026-10-05", "2026-10-06", "2026-10-07", "2026-10-12", "2026-10-14", "2026-10-16", "2026-10-20", "2026-10-21", "2026-10-26");
    expect(habitStreak(thrice, byDate, "2026-10-26")).toEqual({ current: 0, best: 2, unit: "week" });
    expect(habitStreak(thrice, done("2026-10-19", "2026-10-20", "2026-10-21"), "2026-10-26")).toEqual({ current: 1, best: 1, unit: "week" });
  });

  it("is zero with no history", () => {
    expect(habitStreak(habit(), {}, "2026-10-26")).toEqual({ current: 0, best: 0, unit: "day" });
  });
});
