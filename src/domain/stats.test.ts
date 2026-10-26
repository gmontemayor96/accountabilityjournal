import { describe, expect, it } from "vitest";
import "../habitTypes";
import type { Habit, HabitEntry } from "./model";
import { dayStats, entriesByDate, inMonth, monthGrid } from "./stats";

const habit = (id: string, over: Partial<Habit> = {}): Habit => ({
  id, name: id, identity: "", color: "#000", type: "check", target: null, unit: "", schedule: { kind: "daily" },
  sortOrder: 0, createdAt: "", archivedAt: null, tags: [], fields: [], ...over,
});
const entry = (habitId: string, date: string, value: number): HabitEntry => ({ habitId, date, value, note: "", fields: {}, loggedAt: "" });

describe("monthGrid", () => {
  it("covers October 2026 in whole weeks starting Monday", () => {
    const g = monthGrid(2026, 9);
    expect(g[0]).toBe("2026-09-28");
    expect(g.at(-1)).toBe("2026-11-01");
    expect(g.length).toBe(35);
    expect(inMonth("2026-10-31", 2026, 9)).toBe(true);
    expect(inMonth("2026-11-01", 2026, 9)).toBe(false);
  });
});

describe("dayStats", () => {
  const habits = [
    habit("med", { tags: ["mind"] }),
    habit("lift", { schedule: { kind: "weekdays", days: [1] }, tags: ["fitness"] }), // Mondays
    habit("read", { type: "count", target: 20, tags: ["mind"] }),
    habit("old", { archivedAt: "2026-01-01" }),
  ];
  const byDate = entriesByDate([entry("med", "2026-10-26", 1), entry("read", "2026-10-26", 12), entry("lift", "2026-10-26", 1)]);

  it("counts due habits and the ones that met their rule", () => {
    const s = dayStats(habits, "2026-10-26", byDate["2026-10-26"]); // Monday
    expect(s.due.map((h) => h.id)).toEqual(["med", "lift", "read"]);
    expect(s.done.map((h) => h.id)).toEqual(["med", "lift"]);
    expect(s.pct).toBeCloseTo(2 / 3);
  });

  it("skips habits not due that day and narrows by tag", () => {
    expect(dayStats(habits, "2026-10-27", {}).due.map((h) => h.id)).toEqual(["med", "read"]);
    expect(dayStats(habits, "2026-10-26", byDate["2026-10-26"], "mind").done.map((h) => h.id)).toEqual(["med"]);
  });
});
