import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { SqliteRepo } from "../data/sqliteRepo";
import type { Habit, HabitEntry } from "../domain/model";
import { driverFor, memoryDriver, migration } from "../test/sqlite";
import { isEmpty, planMerge } from "./merge";

const habit: Habit = {
  id: "h_read", name: "Read", identity: "I am a reader.", color: "#3D8BD9", type: "count", target: 20, unit: "pages",
  schedule: { kind: "daily" }, sortOrder: 0, createdAt: "2026-10-01T00:00:00.000Z", archivedAt: null, tags: ["mind"], fields: [],
};
const entry = (date: string, value: number): HabitEntry =>
  ({ habitId: "h_read", date, value, note: "", fields: {}, loggedAt: `${date}T08:00:00.000Z` });

/** A device whose clock we move by hand, so "who changed it last" is deterministic. */
function device() {
  let t = 0;
  const clock = { set: (iso: string) => { t = Date.parse(iso); } };
  const repo = new SqliteRepo(memoryDriver(), () => new Date(t).toISOString());
  return { repo, clock };
}

async function pull(into: SqliteRepo, ...from: SqliteRepo[]) {
  const changes = planMerge(await into.snapshot(), await Promise.all(from.map((r) => r.snapshot())));
  await into.applyChanges(changes);
  return changes;
}

const sorted = async (r: SqliteRepo) => {
  const s = await r.snapshot();
  s.entries.sort((x, y) => x.data.date.localeCompare(y.data.date));
  s.tombstones.sort((x, y) => x.key.localeCompare(y.key));
  return s;
};

describe("sync", () => {
  it("copies everything to an empty device and then has nothing left to do", async () => {
    const a = device(), b = device();
    a.clock.set("2026-10-20T10:00:00Z");
    await a.repo.saveTag({ id: "mind", name: "mind", color: "#9B6BD6" });
    await a.repo.saveHabit(habit);
    await a.repo.saveEntry(entry("2026-10-20", 12));
    await a.repo.saveDay({ date: "2026-10-20", journal: "Good day", mood: 3, tags: ["mind"] });

    await pull(b.repo, a.repo);
    expect(await sorted(b.repo)).toEqual(await sorted(a.repo));
    expect(isEmpty(await pull(b.repo, a.repo))).toBe(true);
    expect(isEmpty(await pull(a.repo, b.repo))).toBe(true);
  });

  it("keeps the newer edit when both devices changed the same entry", async () => {
    const a = device(), b = device();
    a.clock.set("2026-10-20T10:00:00Z");
    await a.repo.saveHabit({ ...habit, tags: [] });
    await pull(b.repo, a.repo);

    a.clock.set("2026-10-20T12:00:00Z");
    await a.repo.saveEntry(entry("2026-10-20", 5));
    b.clock.set("2026-10-20T13:00:00Z");
    await b.repo.saveEntry(entry("2026-10-20", 30));

    await pull(a.repo, b.repo);
    await pull(b.repo, a.repo);
    expect((await a.repo.loadDay("2026-10-20")).entries[0].value).toBe(30);
    expect((await b.repo.loadDay("2026-10-20")).entries[0].value).toBe(30);
  });

  it("passes a deletion on, unless the other device edited the entry afterwards", async () => {
    const a = device(), b = device();
    a.clock.set("2026-10-20T10:00:00Z");
    await a.repo.saveHabit({ ...habit, tags: [] });
    await a.repo.saveEntry(entry("2026-10-20", 5));
    await a.repo.saveEntry(entry("2026-10-21", 5));
    await pull(b.repo, a.repo);

    a.clock.set("2026-10-22T10:00:00Z");
    await a.repo.deleteEntry("h_read", "2026-10-20");
    await a.repo.deleteEntry("h_read", "2026-10-21");
    b.clock.set("2026-10-22T11:00:00Z");
    await b.repo.saveEntry(entry("2026-10-21", 9)); // edited after A deleted it

    await pull(b.repo, a.repo);
    await pull(a.repo, b.repo);
    for (const r of [a.repo, b.repo]) {
      expect((await r.loadDay("2026-10-20")).entries).toEqual([]);
      expect((await r.loadDay("2026-10-21")).entries.map((e) => e.value)).toEqual([9]);
    }
  });

  it("removes a deleted tag from habits and days on the other device", async () => {
    const a = device(), b = device();
    a.clock.set("2026-10-20T10:00:00Z");
    await a.repo.saveTag({ id: "mind", name: "mind", color: "#9B6BD6" });
    await a.repo.saveHabit(habit);
    await a.repo.saveDay({ date: "2026-10-20", journal: "", mood: null, tags: ["mind"] });
    await pull(b.repo, a.repo);

    a.clock.set("2026-10-21T10:00:00Z");
    await a.repo.deleteTag("mind");
    await pull(b.repo, a.repo);
    expect(await b.repo.loadTags()).toEqual([]);
    expect((await b.repo.loadHabits())[0].tags).toEqual([]);
    expect((await b.repo.loadDay("2026-10-20")).day.tags).toEqual([]);
  });

  it("merges several devices at once and drops tags it does not know", async () => {
    const a = device(), b = device(), c = device();
    a.clock.set("2026-10-20T10:00:00Z");
    await a.repo.saveHabit({ ...habit, tags: [] });
    b.clock.set("2026-10-20T11:00:00Z");
    await b.repo.saveDay({ date: "2026-10-20", journal: "From B", mood: 2, tags: [] });
    // A day that names a tag nobody shares: the reference is dropped instead of failing.
    const snapA = await a.repo.snapshot();
    snapA.days.push({ data: { date: "2026-10-19", journal: "x", mood: null, tags: ["ghost"] }, updatedAt: "2026-10-20T10:00:00.000Z" });

    await c.repo.applyChanges(planMerge(await c.repo.snapshot(), [snapA, await b.repo.snapshot()]));
    expect((await c.repo.loadHabits()).map((h) => h.id)).toEqual(["h_read"]);
    expect((await c.repo.loadDay("2026-10-20")).day.journal).toBe("From B");
    expect((await c.repo.loadDay("2026-10-19")).day.tags).toEqual([]);
  });

  it("syncs tasks, their edits and their deletion", async () => {
    const a = device(), b = device();
    a.clock.set("2026-10-20T10:00:00Z");
    await a.repo.saveTag({ id: "mind", name: "mind", color: "#9B6BD6" });
    const task = { id: "t1", title: "Call the dentist", notes: "", dueDate: "2026-10-27", dueTime: "09:00", remindAt: "2026-10-27T08:45",
      doneAt: null, createdAt: "2026-10-20T10:00:00.000Z", tags: ["mind"], goalId: null, sortOrder: 0, important: true, urgent: false };
    await a.repo.saveTask(task);
    await a.repo.saveTask({ ...task, id: "t2", title: "Buy stamps", dueDate: null, dueTime: null, remindAt: null, tags: [] });
    await pull(b.repo, a.repo);
    expect((await b.repo.loadTasks()).map((t) => t.title)).toEqual(["Call the dentist", "Buy stamps"]);
    expect((await b.repo.loadTasks())[0]).toEqual(task);

    b.clock.set("2026-10-21T10:00:00Z");
    await b.repo.saveTask({ ...task, doneAt: "2026-10-21T10:00:00.000Z" });
    a.clock.set("2026-10-21T11:00:00Z");
    await a.repo.deleteTask("t2");
    await a.repo.deleteTag("mind");
    await pull(a.repo, b.repo);
    await pull(b.repo, a.repo);
    for (const r of [a.repo, b.repo]) {
      const tasks = await r.loadTasks();
      expect(tasks.map((t) => [t.id, t.doneAt, t.tags])).toEqual([["t1", "2026-10-21T10:00:00.000Z", []]]);
    }
  });

  it("syncs areas and goals, and deleting an area takes its goals and links with it", async () => {
    const a = device(), b = device();
    a.clock.set("2026-10-20T10:00:00Z");
    await a.repo.saveArea({ id: "health", name: "Health", color: "#2FA37A", sortOrder: 0, createdAt: "2026-10-20T10:00:00Z" });
    const goal = { id: "g1", areaId: "health", parentId: null, title: "Run a marathon", notes: "", horizon: "year" as const, doneAt: null, createdAt: "x" };
    await a.repo.saveGoal(goal);
    await a.repo.saveGoal({ ...goal, id: "g2", title: "Run 10k", horizon: "month", parentId: "g1" });
    await a.repo.saveTask({ id: "t1", title: "Long run", notes: "", dueDate: null, dueTime: null, remindAt: null, doneAt: null, createdAt: "x", tags: [], goalId: "g2" });
    await pull(b.repo, a.repo);
    expect((await b.repo.loadGoals()).map((g) => [g.id, g.parentId])).toEqual([["g1", null], ["g2", "g1"]]);
    expect((await b.repo.loadTasks())[0].goalId).toBe("g2");

    b.clock.set("2026-10-21T10:00:00Z");
    await b.repo.deleteGoal("g1");
    expect((await b.repo.loadGoals()).map((g) => [g.id, g.parentId])).toEqual([["g2", null]]);
    await pull(a.repo, b.repo);
    expect((await a.repo.loadGoals()).map((g) => [g.id, g.parentId])).toEqual([["g2", null]]);

    a.clock.set("2026-10-22T10:00:00Z");
    await a.repo.deleteArea("health");
    await pull(b.repo, a.repo);
    for (const r of [a.repo, b.repo]) {
      expect(await r.loadAreas()).toEqual([]);
      expect(await r.loadGoals()).toEqual([]);
      expect((await r.loadTasks())[0].goalId).toBeNull();
    }
  });

  it("reads sync files written before tasks existed", async () => {
    const a = device();
    const old = { ...(await a.repo.snapshot()) } as Record<string, unknown>;
    delete old.tasks;
    expect(isEmpty(planMerge(await a.repo.snapshot(), [old as never]))).toBe(true);
  });

  it("keeps the local copy on an exact tie", () => {
    const at = "2026-10-20T10:00:00.000Z";
    const local = { habits: [{ data: habit, updatedAt: at }], tags: [], days: [], entries: [], tombstones: [] };
    const remote = { ...local, habits: [{ data: { ...habit, name: "Other" }, updatedAt: at }] };
    expect(isEmpty(planMerge(local, [remote]))).toBe(true);
  });

  it("stamps rows that existed before the sync migration", async () => {
    const db = new DatabaseSync(":memory:");
    db.exec(migration("001_init.sql"));
    db.exec(`INSERT INTO habit (id, name, identity, color, type, target, unit, schedule, sort_order, created_at)
             VALUES ('h1', 'Old', '', '#000', 'check', NULL, '', '{"kind":"daily"}', 0, '2026-01-01T00:00:00Z')`);
    db.exec(`INSERT INTO habit_entry (habit_id, date, value, note, fields, logged_at)
             VALUES ('h1', '2026-01-02', 1, '', '{}', '2026-01-02T09:00:00Z')`);
    db.exec(migration("002_sync.sql"));
    db.exec(migration("003_tasks.sql"));
    db.exec(migration("004_goals.sql"));
    db.exec(migration("005_habit_reminders.sql"));
    db.exec(migration("006_sort_order.sql"));
    db.exec(migration("007_eisenhower.sql"));
    const snap = await new SqliteRepo(driverFor(db)).snapshot();
    expect(snap.habits[0].updatedAt).toBe("2026-01-01T00:00:00Z");
    expect(snap.entries[0].updatedAt).toBe("2026-01-02T09:00:00Z");
  });
});

describe("syncOnce", () => {
  it("round-trips two devices through a shared folder", async () => {
    const { syncOnce, SETTING } = await import("./engine");
    const folder = new Map<string, string>();
    const io = {
      readPeers: async (_: string, own: string) => [...folder].filter(([n]) => n !== own).map(([, t]) => t),
      writeOwn: async (_: string, own: string, text: string) => { folder.set(own, text); },
    };
    const a = device(), b = device();
    for (const d of [a, b]) await d.repo.setSetting(SETTING.folder, "/sync");
    a.clock.set("2026-10-20T10:00:00Z");
    await a.repo.saveHabit({ ...habit, tags: [] });
    await a.repo.saveEntry(entry("2026-10-20", 7));

    expect(await syncOnce(a.repo, io, "PC")).toMatchObject({ status: "ok", applied: 0 });
    expect(folder.size).toBe(1);
    expect(await syncOnce(b.repo, io, "Phone")).toMatchObject({ status: "ok", devices: ["PC"], applied: 2 });
    expect((await b.repo.loadDay("2026-10-20")).entries[0].value).toBe(7);
    expect(folder.size).toBe(2);

    // Nothing changed: the file is not rewritten.
    const before = [...folder.values()];
    await syncOnce(b.repo, io, "Phone");
    expect([...folder.values()]).toEqual(before);
  });

  it("is off until a folder is set", async () => {
    const { syncOnce } = await import("./engine");
    const io = { readPeers: async () => [], writeOwn: async () => {} };
    expect(await syncOnce(device().repo, io, "PC")).toEqual({ status: "off" });
  });
});
