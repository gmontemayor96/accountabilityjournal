import { emptyDay, type Day, type Habit, type HabitEntry, type HabitField, type Schedule, type Tag } from "../domain/model";
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
  created_at: string; archived_at: string | null;
}
interface FieldRow { id: string; habit_id: string; label: string; kind: HabitField["kind"] }
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
    }));
  }

  async saveHabit(h: Habit): Promise<void> {
    await this.writeHabit(h, this.now());
  }

  private async writeHabit(h: Habit, updatedAt: string): Promise<void> {
    await this.db.execute(
      `INSERT INTO habit (id, name, identity, color, type, target, unit, schedule, sort_order, created_at, archived_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, identity = excluded.identity, color = excluded.color,
         type = excluded.type, target = excluded.target, unit = excluded.unit, schedule = excluded.schedule,
         sort_order = excluded.sort_order, archived_at = excluded.archived_at, updated_at = excluded.updated_at`,
      [h.id, h.name, h.identity, h.color, h.type, h.target, h.unit, JSON.stringify(h.schedule), h.sortOrder, h.createdAt, h.archivedAt, updatedAt],
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
    const habitIds = new Set((await this.db.select<{ id: string }>("SELECT id FROM habit")).map((h) => h.id));
    await each(c.entries.filter((r) => habitIds.has(r.data.habitId)), (r) => this.writeEntry(r.data, r.updatedAt));
    await each(c.tombstones, (t) => (t.kind === "tag" ? this.removeTag(t) : this.removeEntry(t)));
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
