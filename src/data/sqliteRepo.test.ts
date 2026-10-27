import { beforeEach, describe, expect, it } from "vitest";
import type { Habit } from "../domain/model";
import { memoryDriver } from "../test/sqlite";
import { SqliteRepo } from "./sqliteRepo";

const run: Habit = {
  id: "h_run", name: "Morning run", identity: "I am a runner.", color: "#E07A5F", type: "duration", target: 30, unit: "min",
  schedule: { kind: "weekdays", days: [1, 2, 4, 6] }, sortOrder: 0, createdAt: "2026-10-01T00:00:00Z", archivedAt: null,
  tags: ["fitness"], fields: [{ id: "f_dist", label: "Distance (km)", kind: "number" }], reminders: ["07:00"],
};

describe("SqliteRepo", () => {
  let repo: SqliteRepo;
  beforeEach(async () => {
    repo = new SqliteRepo(memoryDriver());
    await repo.saveTag({ id: "fitness", name: "fitness", color: "#E07A5F" });
    await repo.saveTag({ id: "mind", name: "mind", color: "#9B6BD6" });
  });

  it("saves and reloads a habit with its schedule, tags and fields", async () => {
    await repo.saveHabit(run);
    expect(await repo.loadHabits()).toEqual([run]);
  });

  it("replaces tags and fields when a habit is edited", async () => {
    await repo.saveHabit(run);
    const edited = { ...run, name: "Run", tags: ["mind"], fields: [{ id: "f_route", label: "Route", kind: "text" as const }], reminders: ["06:30", "18:00"] };
    await repo.saveHabit(edited);
    expect(await repo.loadHabits()).toEqual([edited]);
  });

  it("archives and restores without losing the habit", async () => {
    await repo.saveHabit(run);
    await repo.setHabitArchived(run.id, "2026-10-20T00:00:00Z");
    expect((await repo.loadHabits())[0].archivedAt).toBe("2026-10-20T00:00:00Z");
    await repo.setHabitArchived(run.id, null);
    expect((await repo.loadHabits())[0].archivedAt).toBeNull();
  });

  it("stores one entry per habit per day, with note and extra fields", async () => {
    await repo.saveHabit(run);
    const e = { habitId: run.id, date: "2026-10-15", value: 20, note: "River loop", fields: { f_dist: "5.2" }, loggedAt: "2026-10-15T07:00:00Z" };
    await repo.saveEntry(e);
    await repo.saveEntry({ ...e, value: 35 });
    const { entries } = await repo.loadDay("2026-10-15");
    expect(entries).toEqual([{ ...e, value: 35 }]);
    await repo.deleteEntry(run.id, "2026-10-15");
    expect((await repo.loadDay("2026-10-15")).entries).toEqual([]);
  });

  it("returns an empty day, then saves journal, mood and day tags", async () => {
    expect((await repo.loadDay("2026-10-16")).day).toEqual({ date: "2026-10-16", journal: "", mood: null, tags: [] });
    await repo.saveDay({ date: "2026-10-16", journal: "Good run.", mood: 3, tags: ["fitness", "mind"] });
    await repo.saveDay({ date: "2026-10-16", journal: "Good run. Early night.", mood: 4, tags: ["mind"] });
    expect((await repo.loadDay("2026-10-16")).day).toEqual({ date: "2026-10-16", journal: "Good run. Early night.", mood: 4, tags: ["mind"] });
  });

  it("loads a date range with day tags and entries, and finds the earliest date", async () => {
    expect(await repo.earliestDate()).toBeNull();
    await repo.saveHabit(run);
    const e = (date: string) => ({ habitId: run.id, date, value: 30, note: "", fields: {}, loggedAt: `${date}T07:00:00Z` });
    await repo.saveEntry(e("2026-09-30"));
    await repo.saveEntry(e("2026-10-02"));
    await repo.saveDay({ date: "2026-10-01", journal: "Rest day.", mood: 2, tags: [] });
    await repo.saveDay({ date: "2026-10-03", journal: "", mood: null, tags: ["mind"] });
    const { days, entries } = await repo.loadRange("2026-10-01", "2026-10-31");
    expect(days.map((d) => [d.date, d.tags])).toEqual([["2026-10-01", []], ["2026-10-03", ["mind"]]]);
    expect(entries.map((x) => x.date)).toEqual(["2026-10-02"]);
    expect(await repo.earliestDate()).toBe("2026-09-30");
  });

  it("deletes a tag from habits and days", async () => {
    await repo.saveHabit(run);
    await repo.saveDay({ date: "2026-10-16", journal: "", mood: null, tags: ["fitness", "mind"] });
    await repo.deleteTag("fitness");
    expect((await repo.loadTags()).map((t) => t.id)).toEqual(["mind"]);
    expect((await repo.loadHabits())[0].tags).toEqual([]);
    expect((await repo.loadDay("2026-10-16")).day.tags).toEqual(["mind"]);
  });
});
