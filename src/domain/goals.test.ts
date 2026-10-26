import { describe, expect, it } from "vitest";
import { ancestors, goalProgress, parentOptions } from "./goals";
import type { Goal, Horizon, Task } from "./model";

const goal = (id: string, horizon: Horizon, parentId: string | null = null, over: Partial<Goal> = {}): Goal =>
  ({ id, areaId: "health", parentId, title: id, notes: "", horizon, doneAt: null, createdAt: "", ...over });
const task = (id: string, goalId: string, done = false): Task =>
  ({ id, title: id, notes: "", dueDate: null, dueTime: null, remindAt: null, doneAt: done ? "x" : null, createdAt: "", tags: [], goalId });

describe("goalProgress", () => {
  it("is all or nothing by its own tick when it has no steps", () => {
    expect(goalProgress(goal("a", "day"), [], []).pct).toBe(0);
    expect(goalProgress(goal("a", "day", null, { doneAt: "x" }), [], []).done).toBe(true);
  });

  it("counts linked tasks and subgoals as steps, subgoals by their own progress", () => {
    const goals = [goal("year", "year"), goal("m1", "month", "year"), goal("m2", "month", "year", { doneAt: "x" })];
    const tasks = [task("t1", "m1", true), task("t2", "m1"), task("t3", "year", true)];
    // m1 is half done, m2 done, t3 done: (0.5 + 1 + 1) / 3
    const p = goalProgress(goals[0], goals, tasks);
    expect(p.pct).toBeCloseTo(2.5 / 3);
    expect(p.subgoals).toEqual({ done: 1, total: 2 });
    expect(p.tasks).toEqual({ done: 1, total: 1 });
    expect(p.done).toBe(false);
  });

  it("is done once every step is, ignoring its own tick", () => {
    const goals = [goal("w", "week", null, { doneAt: null }), goal("d", "day", "w", { doneAt: "x" })];
    expect(goalProgress(goals[0], goals, [task("t", "w", true)]).done).toBe(true);
    expect(goalProgress(goal("w2", "week", null, { doneAt: "x" }), [], [task("t", "w2")]).done).toBe(false);
  });

  it("survives a loop in the data", () => {
    const goals = [goal("a", "year", "b"), goal("b", "5y", "a")];
    expect(goalProgress(goals[0], goals, []).subgoals.total).toBe(1);
  });
});

describe("parentOptions and ancestors", () => {
  const goals = [goal("ten", "10y"), goal("five", "5y", "ten"), goal("yr", "year", "five"), goal("wk", "week", "yr"), goal("other", "10y", null, { areaId: "work" })];

  it("offers longer goals in the same area, never its own subgoals", () => {
    expect(parentOptions(goals[2], goals).map((g) => g.id)).toEqual(["five", "ten"]);
    expect(parentOptions({ id: "new", areaId: "health", horizon: "day" }, goals).map((g) => g.id)).toEqual(["wk", "yr", "five", "ten"]);
    expect(parentOptions({ ...goals[1], horizon: "day" }, goals).map((g) => g.id)).toEqual(["ten"]);
  });

  it("walks up the chain", () => {
    expect(ancestors(goals[3], goals).map((g) => g.id)).toEqual(["yr", "five", "ten"]);
  });
});
