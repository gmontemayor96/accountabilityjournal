import { describe, expect, it } from "vitest";
import type { Habit, HabitEntry } from "../domain/model";
import { allHabitTypes, getHabitType } from "./index";
import { stepFor } from "./amount";

const habit = (over: Partial<Habit>): Habit => ({
  id: "h", name: "H", identity: "", color: "#000", type: "check", target: null, unit: "",
  schedule: { kind: "daily" }, sortOrder: 0, createdAt: "", archivedAt: null, tags: [], fields: [], ...over,
});
const entry = (value: number | null): HabitEntry => ({ habitId: "h", date: "2026-10-15", value, note: "", fields: {}, loggedAt: "" });

describe("habit types", () => {
  it("registers all four types in editor order", () => {
    expect(allHabitTypes().map((t) => t.key)).toEqual(["check", "count", "duration", "scale"]);
  });

  it("check is done when logged", () => {
    const t = getHabitType("check"), h = habit({});
    expect(t.isDone(h, entry(1))).toBe(true);
    expect(t.isDone(h, entry(null))).toBe(false);
    expect(t.isDone(h, undefined)).toBe(false);
  });

  it("count and duration are done only at the target", () => {
    const read = habit({ type: "count", target: 20, unit: "pages" });
    expect(getHabitType("count").isDone(read, entry(19))).toBe(false);
    expect(getHabitType("count").isDone(read, entry(20))).toBe(true);
    expect(getHabitType("count").format(read, entry(12))).toBe("12 / 20 pages");
    const run = habit({ type: "duration", target: 30, unit: "min" });
    expect(getHabitType("duration").isDone(run, entry(35))).toBe(true);
  });

  it("scale is done with any rating", () => {
    const h = habit({ type: "scale" });
    expect(getHabitType("scale").isDone(h, entry(2))).toBe(true);
    expect(getHabitType("scale").format(h, entry(4))).toBe("4 / 5");
  });

  it("scales the stepper to the target", () => {
    expect(stepFor(habit({ type: "count", target: 8 }))).toBe(1);
    expect(stepFor(habit({ type: "count", target: 20 }))).toBe(5);
    expect(stepFor(habit({ type: "count", target: 500 }))).toBe(50);
    expect(stepFor(habit({ type: "duration", target: 30 }))).toBe(5);
  });
});
