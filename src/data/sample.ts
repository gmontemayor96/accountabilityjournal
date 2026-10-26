import { addDays, todayKey } from "../domain/dates";
import type { Day, Habit, HabitEntry, Tag, Task } from "../domain/model";
import { isDue } from "../domain/schedule";

const now = "2026-10-01T00:00:00.000Z";
const base = { archivedAt: null, createdAt: now, fields: [], tags: [] as string[] };

/** Small deterministic random generator, so the preview looks the same on every load. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/** Example habits and six weeks of history for the browser preview only. The desktop app starts empty. */
export function sampleData(today = todayKey()): { habits: Habit[]; tags: Tag[]; days: Record<string, Day>; entries: Record<string, HabitEntry>; tasks: Task[] } {
  const tags: Tag[] = [
    { id: "fitness", name: "fitness", color: "#E07A5F" },
    { id: "mind", name: "mind", color: "#9B6BD6" },
    { id: "health", name: "health", color: "#3D8BD9" },
    { id: "deep-work", name: "deep work", color: "#2FA37A" },
    { id: "travel", name: "travel", color: "#3FA3B5" },
  ];
  const habits: Habit[] = [
    { ...base, id: "h_run", name: "Morning run", identity: "I am a runner.", color: "#E07A5F", type: "duration", target: 30, unit: "min",
      schedule: { kind: "weekdays", days: [1, 2, 4, 6] }, sortOrder: 0, tags: ["fitness"],
      fields: [{ id: "f_dist", label: "Distance (km)", kind: "number" }, { id: "f_route", label: "Route", kind: "text" }] },
    { ...base, id: "h_read", name: "Read", identity: "I am a reader.", color: "#3D8BD9", type: "count", target: 20, unit: "pages",
      schedule: { kind: "daily" }, sortOrder: 1, tags: ["mind"], fields: [{ id: "f_book", label: "Book", kind: "text" }] },
    { ...base, id: "h_med", name: "Meditate", identity: "I am calm under pressure.", color: "#9B6BD6", type: "check", target: null, unit: "",
      schedule: { kind: "daily" }, sortOrder: 2, tags: ["mind", "health"] },
    { ...base, id: "h_energy", name: "Energy level", identity: "", color: "#7F9440", type: "scale", target: null, unit: "",
      schedule: { kind: "daily" }, sortOrder: 3, tags: ["health"] },
  ];
  const journals = [
    "Slept well. The run felt easy and I stayed off the phone at night.",
    "Busy day at work. Skipped the run but read on the train.",
    "Felt scattered in the morning. Ten minutes of meditation helped more than coffee.",
    "Deep work block from 9 to 12, the best focus in weeks.",
    "Low energy, probably the late night. Early bed tonight.",
  ];
  const r = rng(7);
  const days: Record<string, Day> = {};
  const entries: Record<string, HabitEntry> = {};
  for (let i = 42; i >= 1; i--) {
    const date = addDays(today, -i);
    const good = r();
    for (const h of habits) {
      if (!isDue(h.schedule, date) || r() > 0.45 + good * 0.5) continue;
      const value = h.type === "check" ? 1 : h.type === "scale" ? 2 + Math.floor(r() * 4) : h.type === "duration" ? 20 + Math.floor(r() * 5) * 5 : 8 + Math.floor(r() * 20);
      const note = h.id === "h_run" && r() < 0.3 ? "River loop" : h.id === "h_read" && r() < 0.2 ? "Finished a chapter" : "";
      entries[`${h.id}|${date}`] = { habitId: h.id, date, value, note, fields: {}, loggedAt: `${date}T0${6 + Math.floor(r() * 3)}:30:00.000Z` };
    }
    const tag = r();
    days[date] = {
      date,
      journal: r() < 0.55 ? journals[Math.floor(r() * journals.length)] : "",
      mood: r() < 0.6 ? Math.min(4, Math.round(good * 4)) : null,
      tags: tag < 0.15 ? ["travel"] : tag < 0.35 ? ["deep-work"] : [],
    };
  }
  const task = (id: string, title: string, dueDate: string | null, over: Partial<Task> = {}): Task =>
    ({ id, title, notes: "", dueDate, dueTime: null, remindAt: null, doneAt: null, createdAt: now, tags: [], ...over });
  const tasks = [
    task("t_dentist", "Book the dentist", today, { dueTime: "10:00", remindAt: `${today}T09:45`, tags: ["health"] }),
    task("t_shoes", "Replace running shoes", addDays(today, -1), { tags: ["fitness"] }),
    task("t_trip", "Pack for the weekend", addDays(today, 3), { notes: "Charger, book, rain jacket", tags: ["travel"] }),
    task("t_tax", "Send tax documents", addDays(today, 9)),
    task("t_library", "Return library books", null, { tags: ["mind"] }),
    task("t_plants", "Water the plants", addDays(today, -2), { doneAt: `${addDays(today, -2)}T18:00:00.000Z` }),
  ];
  return { habits, tags, days, entries, tasks };
}
