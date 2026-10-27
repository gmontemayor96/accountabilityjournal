import { emptyDay, type Area, type Day, type Goal, type Habit, type HabitEntry, type HabitField, type Horizon, type Schedule, type Tag, type Task } from "../domain/model";
import { entryKey, type SyncChanges, type SyncData, type Tombstone } from "../sync/types";
import type { Repo } from "./repo";

/** The two calls the repository needs from a SQLite connection. Uses `?` placeholders. */
export interface SqlDriver {
  execute(sql: string, params?: unknown[]): Promise<void>;
  select<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

interface HabitRow {
  id: string; name: string; identity: string; color: string; type: Habit["type"];
  target: number | null; unit: string; schedule: string; sort_order: number;
  created_at: string; archived_at: string | null; reminders: string | null;
}
interface FieldRow { id: string; habit_id: string; label: string; kind: HabitField["kind"] }
interface TaskRow {
  id: string; title: string; notes: string; due_date: string | null; due_time: string | null;
  remind_at: string | null; done_at: string | null; created_at: string; updated_at: string; goal_id: string | null;
}
interface AreaRow { id: string; name: string; color: string; sort_order: number; created_at: string; updated_at: string }
interface GoalRow {
  id: string; area_id: string; parent_id: string | null; title: string; notes: string; horizon: Horizon;
  done_at: string | null; created_at: string; updated_at: string;
}
interface EntryRow { habit_id: string; date: string; value: number | null; note: string; fields: string; logged_at: string }

function parseJson<T>(text: string | null | undefined, fallback: T): T {
  try {
    return text ? (JSON.parse(text) as T) : fallback;
  } catch {
    return fallback;
  }
}

function toEntry(e: EntryRow): HabitEntry {
  return {
    habitId: e.habit_id,
    date: e.date,
    value: e.value,
    note: e.note ?? "",
    fields: parseJson<Record<string, string>>(e.fields, {}),
    loggedAt: e.logged_at,
  };
}

const EARLY = "2000-01-01T00:00:00.000Z";

export class SqliteRepo implements Repo {
  constructor(private db: SqlDriver, private now: () => string = () => new Date().toISOString()) {}

  async loadHabits(): Promise<Habit[]> {
    const rows = await this.db.select<HabitRow>("SELECT * FROM habit ORDER BY sort_order, created_at");
    const fields = await this.db.select<FieldRow>("SELECT id, habit_id, label, kind FROM habit_field ORDER BY sort_order");
    const tags = await this.db.select<{ habit_id: string; tag_id: string }>("SELECT habit_id, tag_id FROM habit_tag");
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      identity: r.identity ?? "",
      color: r.color,
      type: r.type,
      target: r.target,
      unit: r.unit ?? "",
      schedule: parseJson<Schedule>(r.schedule, { kind: "daily" }),
      sortOrder: r.sort_order,
      createdAt: r.created_at,
      archivedAt: r.archived_at,
      tags: tags.filter((t) => t.habit_id === r.id).map((t) => t.tag_id),
      fields: fields.filter((f) => f.habit_id === r.id).map(({ id, label, kind }) => ({ id, label, kind })),
      reminders: parseJson<string[]>(r.reminders, []),
    }));
  }

  async saveHabit(h: Habit): Promise<void> {
    await this.writeHabit(h, this.now());
  }

  private async writeHabit(h: Habit, updatedAt: string): Promise<void> {
    await this.db.execute(
      `INSERT INTO habit (id, name, identity, color, type, target, unit, schedule, sort_order, created_at, archived_at, updated_at, reminders)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, identity = excluded.identity, color = excluded.color,
         type = excluded.type, target = excluded.target, unit = excluded.unit, schedule = excluded.schedule,
         sort_order = excluded.sort_order, archived_at = excluded.archived_at, updated_at = excluded.updated_at, reminders = excluded.reminders`,
      [h.id, h.name, h.identity, h.color, h.type, h.target, h.unit, JSON.stringify(h.schedule), h.sortOrder, h.createdAt, h.archivedAt, updatedAt,
        JSON.stringify(h.reminders ?? [])],
    );
    await this.db.execute("DELETE FROM habit_field WHERE habit_id = ?", [h.id]);
    for (const [i, f] of h.fields.entries()) {
      await this.db.execute("INSERT INTO habit_field (id, habit_id, label, kind, sort_order) VALUES (?, ?, ?, ?, ?)", [f.id, h.id, f.label, f.kind, i]);
    }
    await this.db.execute("DELETE FROM habit_tag WHERE habit_id = ?", [h.id]);
    for (const tagId of h.tags) {
      await this.db.execute("INSERT INTO habit_tag (habit_id, tag_id) VALUES (?, ?)", [h.id, tagId]);
    }
  }

  async setHabitArchived(id: string, archivedAt: string | null): Promise<void> {
    await this.db.execute("UPDATE habit SET archived_at = ?, updated_at = ? WHERE id = ?", [archivedAt, this.now(), id]);
  }

  async loadTags(): Promise<Tag[]> {
    return this.db.select<Tag>("SELECT id, name, color FROM tag ORDER BY name");
  }

  async saveTag(t: Tag): Promise<void> {
    await this.writeTag(t, this.now());
  }

  private async writeTag(t: Tag, updatedAt: string): Promise<void> {
    await this.db.execute(
      `INSERT INTO tag (id, name, color, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color, updated_at = excluded.updated_at`,
      [t.id, t.name, t.color, updatedAt],
    );
    await this.db.execute("DELETE FROM tombstone WHERE kind = 'tag' AND key = ?", [t.id]);
  }

  async deleteTag(id: string): Promise<void> {
    await this.removeTag({ kind: "tag", key: id, deletedAt: this.now() });
  }

  private async removeTag(t: Tombstone): Promise<void> {
    await this.db.execute("DELETE FROM habit_tag WHERE tag_id = ?", [t.key]);
    await this.db.execute("DELETE FROM day_tag WHERE tag_id = ?", [t.key]);
    await this.db.execute("DELETE FROM task_tag WHERE tag_id = ?", [t.key]);
    await this.db.execute("DELETE FROM tag WHERE id = ?", [t.key]);
    await this.writeTombstone(t);
  }

  private async writeTombstone(t: Tombstone): Promise<void> {
    await this.db.execute(
      `INSERT INTO tombstone (kind, key, deleted_at) VALUES (?, ?, ?)
       ON CONFLICT(kind, key) DO UPDATE SET deleted_at = excluded.deleted_at`,
      [t.kind, t.key, t.deletedAt],
    );
  }

  async loadTasks(): Promise<Task[]> {
    return (await this.taskRows()).map(({ task }) => task);
  }

  private async taskRows(): Promise<{ task: Task; updatedAt: string }[]> {
    const rows = await this.db.select<TaskRow>("SELECT * FROM task ORDER BY due_date IS NULL, due_date, due_time, created_at");
    const tags = await this.db.select<{ task_id: string; tag_id: string }>("SELECT task_id, tag_id FROM task_tag");
    return rows.map((r) => ({
      updatedAt: r.updated_at || EARLY,
      task: {
        id: r.id, title: r.title, notes: r.notes ?? "", dueDate: r.due_date, dueTime: r.due_time, remindAt: r.remind_at,
        doneAt: r.done_at, createdAt: r.created_at, tags: tags.filter((t) => t.task_id === r.id).map((t) => t.tag_id),
        goalId: r.goal_id ?? null,
      },
    }));
  }

  async saveTask(t: Task): Promise<void> {
    await this.writeTask(t, this.now());
  }

  private async writeTask(t: Task, updatedAt: string): Promise<void> {
    await this.db.execute(
      `INSERT INTO task (id, title, notes, due_date, due_time, remind_at, done_at, created_at, updated_at, goal_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET title = excluded.title, notes = excluded.notes, due_date = excluded.due_date,
         due_time = excluded.due_time, remind_at = excluded.remind_at, done_at = excluded.done_at, updated_at = excluded.updated_at,
         goal_id = excluded.goal_id`,
      [t.id, t.title, t.notes, t.dueDate, t.dueTime, t.remindAt, t.doneAt, t.createdAt, updatedAt, t.goalId ?? null],
    );
    await this.db.execute("DELETE FROM task_tag WHERE task_id = ?", [t.id]);
    for (const tagId of t.tags) {
      await this.db.execute("INSERT INTO task_tag (task_id, tag_id) VALUES (?, ?)", [t.id, tagId]);
    }
    await this.db.execute("DELETE FROM tombstone WHERE kind = 'task' AND key = ?", [t.id]);
  }

  async deleteTask(id: string): Promise<void> {
    await this.removeTask({ kind: "task", key: id, deletedAt: this.now() });
  }

  private async removeTask(t: Tombstone): Promise<void> {
    await this.db.execute("DELETE FROM task_tag WHERE task_id = ?", [t.key]);
    await this.db.execute("DELETE FROM task WHERE id = ?", [t.key]);
    await this.writeTombstone(t);
  }

  private async areaRows(): Promise<{ area: Area; updatedAt: string }[]> {
    const rows = await this.db.select<AreaRow>("SELECT * FROM area ORDER BY sort_order, created_at");
    return rows.map((r) => ({
      updatedAt: r.updated_at || EARLY,
      area: { id: r.id, name: r.name, color: r.color, sortOrder: r.sort_order, createdAt: r.created_at },
    }));
  }

  async loadAreas(): Promise<Area[]> {
    return (await this.areaRows()).map(({ area }) => area);
  }

  async saveArea(a: Area): Promise<void> {
    await this.writeArea(a, this.now());
  }

  private async writeArea(a: Area, updatedAt: string): Promise<void> {
    await this.db.execute(
      `INSERT INTO area (id, name, color, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color, sort_order = excluded.sort_order,
         updated_at = excluded.updated_at`,
      [a.id, a.name, a.color, a.sortOrder, a.createdAt, updatedAt],
    );
    await this.db.execute("DELETE FROM tombstone WHERE kind = 'area' AND key = ?", [a.id]);
  }

  async deleteArea(id: string): Promise<void> {
    const at = this.now();
    for (const g of await this.db.select<{ id: string }>("SELECT id FROM goal WHERE area_id = ?", [id])) {
      await this.removeGoal({ kind: "goal", key: g.id, deletedAt: at });
    }
    await this.removeArea({ kind: "area", key: id, deletedAt: at });
  }

  private async removeArea(t: Tombstone): Promise<void> {
    // Goals of the area that only this device had go too; their own tombstones were sent with the area's.
    for (const g of await this.db.select<{ id: string }>("SELECT id FROM goal WHERE area_id = ?", [t.key])) {
      await this.removeGoal({ kind: "goal", key: g.id, deletedAt: t.deletedAt });
    }
    await this.db.execute("DELETE FROM area WHERE id = ?", [t.key]);
    await this.writeTombstone(t);
  }

  private async goalRows(): Promise<{ goal: Goal; updatedAt: string }[]> {
    const rows = await this.db.select<GoalRow>("SELECT * FROM goal ORDER BY created_at");
    return rows.map((r) => ({
      updatedAt: r.updated_at || EARLY,
      goal: {
        id: r.id, areaId: r.area_id, parentId: r.parent_id, title: r.title, notes: r.notes ?? "", horizon: r.horizon,
        doneAt: r.done_at, createdAt: r.created_at,
      },
    }));
  }

  async loadGoals(): Promise<Goal[]> {
    return (await this.goalRows()).map(({ goal }) => goal);
  }

  async saveGoal(g: Goal): Promise<void> {
    await this.writeGoal(g, this.now());
  }

  private async writeGoal(g: Goal, updatedAt: string): Promise<void> {
    await this.db.execute(
      `INSERT INTO goal (id, area_id, parent_id, title, notes, horizon, done_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET area_id = excluded.area_id, parent_id = excluded.parent_id, title = excluded.title,
         notes = excluded.notes, horizon = excluded.horizon, done_at = excluded.done_at, updated_at = excluded.updated_at`,
      [g.id, g.areaId, g.parentId, g.title, g.notes, g.horizon, g.doneAt, g.createdAt, updatedAt],
    );
    await this.db.execute("DELETE FROM tombstone WHERE kind = 'goal' AND key = ?", [g.id]);
  }

  async deleteGoal(id: string): Promise<void> {
    await this.removeGoal({ kind: "goal", key: id, deletedAt: this.now() });
  }

  // Links are cleared without new timestamps: every device does the same when the tombstone arrives.
  private async removeGoal(t: Tombstone): Promise<void> {
    await this.db.execute("UPDATE goal SET parent_id = NULL WHERE parent_id = ?", [t.key]);
    await this.db.execute("UPDATE task SET goal_id = NULL WHERE goal_id = ?", [t.key]);
    await this.db.execute("DELETE FROM goal WHERE id = ?", [t.key]);
    await this.writeTombstone(t);
  }

  async loadDay(date: string): Promise<{ day: Day; entries: HabitEntry[] }> {
    const [row] = await this.db.select<{ journal: string; mood: number | null }>("SELECT journal, mood FROM day WHERE date = ?", [date]);
    const tags = await this.db.select<{ tag_id: string }>("SELECT tag_id FROM day_tag WHERE date = ?", [date]);
    const entries = await this.db.select<EntryRow>("SELECT * FROM habit_entry WHERE date = ?", [date]);
    const day: Day = row
      ? { date, journal: row.journal ?? "", mood: row.mood, tags: tags.map((t) => t.tag_id) }
      : { ...emptyDay(date), tags: tags.map((t) => t.tag_id) };
    return { day, entries: entries.map(toEntry) };
  }

  async loadRange(from: string, to: string): Promise<{ days: Day[]; entries: HabitEntry[] }> {
    const rows = await this.db.select<{ date: string; journal: string; mood: number | null }>(
      "SELECT date, journal, mood FROM day WHERE date BETWEEN ? AND ?", [from, to]);
    const tags = await this.db.select<{ date: string; tag_id: string }>("SELECT date, tag_id FROM day_tag WHERE date BETWEEN ? AND ?", [from, to]);
    const entries = await this.db.select<EntryRow>("SELECT * FROM habit_entry WHERE date BETWEEN ? AND ? ORDER BY date", [from, to]);
    const days = new Map<string, Day>();
    for (const r of rows) days.set(r.date, { date: r.date, journal: r.journal ?? "", mood: r.mood, tags: [] });
    for (const t of tags) {
      if (!days.has(t.date)) days.set(t.date, emptyDay(t.date));
      days.get(t.date)!.tags.push(t.tag_id);
    }
    return { days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)), entries: entries.map(toEntry) };
  }

  async earliestDate(): Promise<string | null> {
    const [row] = await this.db.select<{ d: string | null }>(
      "SELECT MIN(d) AS d FROM (SELECT MIN(date) AS d FROM habit_entry UNION ALL SELECT MIN(date) FROM day UNION ALL SELECT MIN(date) FROM day_tag)");
    return row?.d ?? null;
  }

  async saveDay(day: Day): Promise<void> {
    await this.writeDay(day, this.now());
  }

  private async writeDay(day: Day, updatedAt: string): Promise<void> {
    await this.db.execute(
      `INSERT INTO day (date, journal, mood, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET journal = excluded.journal, mood = excluded.mood, updated_at = excluded.updated_at`,
      [day.date, day.journal, day.mood, updatedAt],
    );
    await this.db.execute("DELETE FROM day_tag WHERE date = ?", [day.date]);
    for (const tagId of day.tags) {
      await this.db.execute("INSERT INTO day_tag (date, tag_id) VALUES (?, ?)", [day.date, tagId]);
    }
  }

  async saveEntry(e: HabitEntry): Promise<void> {
    await this.writeEntry(e, this.now());
  }

  private async writeEntry(e: HabitEntry, updatedAt: string): Promise<void> {
    await this.db.execute(
      `INSERT INTO habit_entry (habit_id, date, value, note, fields, logged_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(habit_id, date) DO UPDATE SET value = excluded.value, note = excluded.note, fields = excluded.fields,
         updated_at = excluded.updated_at`,
      [e.habitId, e.date, e.value, e.note, JSON.stringify(e.fields), e.loggedAt, updatedAt],
    );
    await this.db.execute("DELETE FROM tombstone WHERE kind = 'entry' AND key = ?", [entryKey(e)]);
  }

  async deleteEntry(habitId: string, date: string): Promise<void> {
    await this.removeEntry({ kind: "entry", key: entryKey({ habitId, date }), deletedAt: this.now() });
  }

  private async removeEntry(t: Tombstone): Promise<void> {
    const [habitId, date] = t.key.split("|");
    await this.db.execute("DELETE FROM habit_entry WHERE habit_id = ? AND date = ?", [habitId, date]);
    await this.writeTombstone(t);
  }

  async snapshot(): Promise<SyncData> {
    const stamps = async (sql: string) =>
      new Map((await this.db.select<{ k: string; t: string }>(sql)).map((r) => [r.k, r.t || EARLY]));
    const habitAt = await stamps("SELECT id AS k, updated_at AS t FROM habit");
    const tagAt = await stamps("SELECT id AS k, updated_at AS t FROM tag");
    const dayAt = await stamps("SELECT date AS k, updated_at AS t FROM day");
    const entryAt = await stamps("SELECT habit_id || '|' || date AS k, updated_at AS t FROM habit_entry");
    const { days, entries } = await this.loadRange("0000-01-01", "9999-12-31");
    const tombstones = await this.db.select<{ kind: Tombstone["kind"]; key: string; deleted_at: string }>(
      "SELECT kind, key, deleted_at FROM tombstone");
    return {
      habits: (await this.loadHabits()).map((data) => ({ data, updatedAt: habitAt.get(data.id) ?? EARLY })),
      tags: (await this.loadTags()).map((data) => ({ data, updatedAt: tagAt.get(data.id) ?? EARLY })),
      days: days.map((data) => ({ data, updatedAt: dayAt.get(data.date) ?? EARLY })),
      entries: entries.map((data) => ({ data, updatedAt: entryAt.get(entryKey(data)) ?? EARLY })),
      tasks: (await this.taskRows()).map(({ task, updatedAt }) => ({ data: task, updatedAt })),
      areas: (await this.areaRows()).map(({ area, updatedAt }) => ({ data: area, updatedAt })),
      goals: (await this.goalRows()).map(({ goal, updatedAt }) => ({ data: goal, updatedAt })),
      tombstones: tombstones.map((t) => ({ kind: t.kind, key: t.key, deletedAt: t.deleted_at })),
    };
  }

  async applyChanges(c: SyncChanges): Promise<void> {
    // One bad record (say, two tags renamed to the same name on two devices) must not stop the rest.
    const each = async <T,>(rows: T[], fn: (row: T) => Promise<void>) => {
      for (const row of rows) {
        try {
          await fn(row);
        } catch (err) {
          console.warn("sync: skipped a record", row, err);
        }
      }
    };
    await each(c.tags, (r) => this.writeTag(r.data, r.updatedAt));
    const tagIds = new Set((await this.loadTags()).map((t) => t.id));
    const known = (ids: string[]) => ids.filter((id) => tagIds.has(id));
    await each(c.habits, (r) => this.writeHabit({ ...r.data, tags: known(r.data.tags) }, r.updatedAt));
    await each(c.days, (r) => this.writeDay({ ...r.data, tags: known(r.data.tags) }, r.updatedAt));
    await each(c.areas ?? [], (r) => this.writeArea(r.data, r.updatedAt));
    await each(c.goals ?? [], (r) => this.writeGoal(r.data, r.updatedAt));
    await each(c.tasks ?? [], (r) => this.writeTask({ ...r.data, tags: known(r.data.tags) }, r.updatedAt));
    const habitIds = new Set((await this.db.select<{ id: string }>("SELECT id FROM habit")).map((h) => h.id));
    await each(c.entries.filter((r) => habitIds.has(r.data.habitId)), (r) => this.writeEntry(r.data, r.updatedAt));
    // Goals before areas, so an area's own goals are already gone with their own timestamps.
    const order: Tombstone["kind"][] = ["tag", "task", "entry", "goal", "area"];
    const tombstones = [...c.tombstones].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
    await each(tombstones, (t) =>
      t.kind === "tag" ? this.removeTag(t)
        : t.kind === "task" ? this.removeTask(t)
          : t.kind === "goal" ? this.removeGoal(t)
            : t.kind === "area" ? this.removeArea(t)
              : this.removeEntry(t));
  }

  async getSetting(key: string): Promise<string | null> {
    const [row] = await this.db.select<{ value: string }>("SELECT value FROM setting WHERE key = ?", [key]);
    return row?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.db.execute(
      "INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, value]);
  }
}
